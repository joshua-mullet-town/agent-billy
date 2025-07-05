import { callLLM } from '../cognition/llmWrapper';
import { PromptLoader } from '../cognition/promptLoader';

export interface CodeWriterInput {
  taskDescription: string;
  fileContext?: string;
  projectStructure?: string;
}

export interface CodeWriterOutput {
  files: Array<{
    filename: string;
    content: string;
  }>;
  comments: string;
}

export class CodeWriterAgent {
  async generateCode(input: CodeWriterInput): Promise<CodeWriterOutput> {
    try {
      // Load the prompt template
      const prompt = await PromptLoader.loadPrompt('codeWriterPrompt', {
        taskDescription: input.taskDescription,
        fileContext: input.fileContext || 'No specific file context provided',
        projectStructure: input.projectStructure || 'No project structure provided'
      });

      // Call the LLM
      const response = await callLLM({
        prompt,
        options: {
          temperature: 0.1,
          maxTokens: 2000
        }
      });

      // Parse the response
      try {
        const parsedResponse = JSON.parse(response.content);
        return {
          files: parsedResponse.files || [],
          comments: parsedResponse.comments || 'No comments provided'
        };
      } catch (parseError) {
        // If JSON parsing fails, return a basic structure
        return {
          files: [{
            filename: 'generated-code.txt',
            content: response.content
          }],
          comments: 'Raw LLM response (JSON parsing failed)'
        };
      }
    } catch (error) {
      throw new Error(`Code generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const codeWriterAgent = new CodeWriterAgent();