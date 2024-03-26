import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

function isDirectory(filePath: string): boolean {
	try {
		const stats = fs.statSync(filePath);
		return stats.isDirectory();
	} catch (err) {
		return false;
	}
}

function extractXfdlFiles(uris: vscode.Uri[]): string[] {
	const xfdlFiles: string[] = [];

	function traverseDirectory(dirPath: string) {
		const files = fs.readdirSync(dirPath);
		for (const file of files) {
			const filePath = path.join(dirPath, file);
			if (isDirectory(filePath)) {
				traverseDirectory(filePath);
			} else if (path.extname(file) === '.xfdl' || path.extname(file) === '.xadl' || path.extname(file) === '.xprj') {
				xfdlFiles.push(`'${filePath}'`);
			}
		}
	}

	for (const uri of uris) {
		const fsPath = uri.fsPath;
		if (isDirectory(fsPath)) {
			traverseDirectory(fsPath);
		} else if (path.extname(fsPath) === '.xfdl' || path.extname(fsPath) === '.xadl' || path.extname(fsPath) === '.xprj') {
			xfdlFiles.push(`'${fsPath}'`);
		}
	}
	return xfdlFiles;
}

function findXprjXadlFile(filePath: string) {
	return filePath.indexOf('.xprj') >= 0 || filePath.indexOf('.xadl') >= 0;
}


function splitAndQuoteFilePath(filePath: string) {
	const elements = filePath.split(/[\\/]/);
	// 각 요소 문자열을 검사하여 필요한 경우 큰따옴표로 감싸기
	const quotedElements = elements.map(element => {
		if (element.includes(' ')) {
			return `"${element}"`;
		}
		return element;
	});
	const quotedFilePath = quotedElements.join('/');
	return quotedFilePath;
}

export function activate(context: vscode.ExtensionContext) {

	let outputChannel = vscode.window.createOutputChannel('Nexacro Helper');
	let disposable2 = vscode.commands.registerCommand('nexacro.regenerateFile', (...commandArgs) => {
		const config = vscode.workspace.getConfiguration('nexacro');
		const deployFilePath = config.get('deployFilePath', '');
		const xprjFilePath = config.get('xprjFilePath', '');
		const generateFolderPath = config.get('generateFolderPath', '');
		const baseLibFolderPath = config.get('baseLibFolderPath', '');
		const generateRuleFolderPath = config.get('generateRuleFolderPath', '');

		if (process.platform === 'win32') {
			const uris: vscode.Uri[] = commandArgs.at(1);
			// Windows에서 실행할 CLI 명령어
			const options: cp.ExecOptionsWithStringEncoding = {
				encoding: 'utf8' // 인코딩을 UTF-8로 설정
			};
			let command = splitAndQuoteFilePath(deployFilePath);
			command += ` -P "${xprjFilePath}" -O "${generateFolderPath}" -B "${baseLibFolderPath}" -GENERATERULE "${generateRuleFolderPath}" -REGENERATE`;
			if (uris != undefined && uris.length > 0) {
				const filePaths = extractXfdlFiles(uris);
				if (!filePaths.some(findXprjXadlFile)) {
					const fileParam = uris.map(uri => `'${uri.fsPath}'`).join(',');
					command += ` -FILE "${fileParam}"`
				}				
			}
			// 명령어 실행
			cp.exec(command, options, (error, stdout, stderr) => {
				outputChannel.appendLine(command);
				if (error) {
					console.log(stderr);
					vscode.window.showErrorMessage(`Error executing command: ${error.message}`);
					return;
				}
				outputChannel.appendLine(`stdout: ${stdout}`);
				// 명령어 실행 결과 처리
				vscode.window.showInformationMessage('Command executed successfully.');
			});
			outputChannel.show();
		} else {
			// Windows 이외의 플랫폼에서 실행할 코드
			vscode.window.showInformationMessage(`This command is not supported on ${process.platform}.`);
		}
	});

	context.subscriptions.push(disposable2);

	let disposable = vscode.commands.registerCommand('nexacro.generateFile', (uri) => {
		vscode.window.showInformationMessage(`Hello World from nexacro-generate! Generate File ${uri.fsPath}`);
	});

	context.subscriptions.push(disposable);

	// 파일 저장 이벤트 리스너 등록
	vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
		if (document.languageId === 'xfdl') {
			const config = vscode.workspace.getConfiguration('nexacro');
			const enableGenerateOnSave = config.get('enableGenerateOnSave', true);

			if (enableGenerateOnSave) {
				// 파일 저장 후 Generate 수행
				const infoMessage = `Generation performed after saving ${document.fileName.substring(document.fileName.lastIndexOf('\\')+1)} file.`;
				const infoTimeout = 8000; // 8초
				// Generate 코드 작성
				vscode.window.setStatusBarMessage(infoMessage, infoTimeout);
				outputChannel.appendLine(`Generation performed after saving .xfdl file.`);
				outputChannel.show();
			}
		}
	});



}

// This method is called when your extension is deactivated
export function deactivate() { }


