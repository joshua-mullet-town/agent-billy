import { FileIOUtils } from '../utils/fileIO';
import * as path from 'path';

export interface PromptVariables {
  [key: string]: string;
}

export class PromptLoader {
  private static promptsDir = path.join(process.cwd(), 'prompts');

  static async loadPrompt(promptName: string, variables: PromptVariables = {}): Promise<string> {
    const promptPath = path.join(this.promptsDir, `${promptName}.md`);
    
    if (!(await FileIOUtils.fileExists(promptPath))) {
      throw new Error(`Prompt file not found: ${promptPath}`);
    }

    let prompt = await FileIOUtils.readFile(promptPath);

    // Replace variables in the prompt
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      prompt = prompt.replace(new RegExp(placeholder, 'g'), value);
    }

    return prompt;
  }

  static async getAvailablePrompts(): Promise<string[]> {
    try {
      const fs = await import('fs');
      const files = await fs.promises.readdir(this.promptsDir);
      return files
        .filter(file => file.endsWith('.md'))
        .map(file => file.replace('.md', ''));
    } catch (error) {
      return [];
    }
  }
}