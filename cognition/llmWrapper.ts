import axios from 'axios';

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  model?: 'claude' | 'gpt' | 'ollama';
}

export interface LLMRequest {
  prompt: string;
  model?: 'claude' | 'gpt' | 'ollama';
  options?: LLMOptions;
}

export interface LLMResponse {
  content: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export class LLMWrapper {
  private defaultModel: 'claude' | 'gpt' | 'ollama';

  constructor(defaultModel: 'claude' | 'gpt' | 'ollama' = 'claude') {
    this.defaultModel = defaultModel;
  }

  async callLLM(request: LLMRequest): Promise<LLMResponse> {
    const model = request.model || this.defaultModel;
    
    switch (model) {
      case 'claude':
        return this.callClaude(request);
      case 'gpt':
        return this.callGPT(request);
      case 'ollama':
        return this.callOllama(request);
      default:
        throw new Error(`Unsupported model: ${model}`);
    }
  }

  private async callClaude(request: LLMRequest): Promise<LLMResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not found in environment variables');
    }

    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-haiku-20240307',
          max_tokens: request.options?.maxTokens || 1000,
          messages: [
            {
              role: 'user',
              content: request.prompt
            }
          ],
          temperature: request.options?.temperature || 0.7
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          }
        }
      );

      return {
        content: response.data.content[0].text,
        usage: {
          inputTokens: response.data.usage.input_tokens,
          outputTokens: response.data.usage.output_tokens
        }
      };
    } catch (error) {
      console.error('❌ Anthropic API error:', error);
      // Fallback to placeholder if API fails
      return {
        content: `[CLAUDE ERROR] Failed to get AI response: ${error instanceof Error ? error.message : String(error)}`,
        usage: {
          inputTokens: request.prompt.length / 4,
          outputTokens: 50
        }
      };
    }
  }

  private async callGPT(request: LLMRequest): Promise<LLMResponse> {
    // TODO: Implement OpenAI API integration
    return {
      content: `[GPT PLACEHOLDER] Response to: ${request.prompt.substring(0, 50)}...`,
      usage: {
        inputTokens: request.prompt.length / 4,
        outputTokens: 100
      }
    };
  }

  private async callOllama(request: LLMRequest): Promise<LLMResponse> {
    // TODO: Implement Ollama API integration
    return {
      content: `[OLLAMA PLACEHOLDER] Response to: ${request.prompt.substring(0, 50)}...`,
      usage: {
        inputTokens: request.prompt.length / 4,
        outputTokens: 100
      }
    };
  }
}

// Export singleton instance
export const llmWrapper = new LLMWrapper();

// Export helper function for direct calls
export async function callLLM(request: LLMRequest): Promise<LLMResponse> {
  return llmWrapper.callLLM(request);
}