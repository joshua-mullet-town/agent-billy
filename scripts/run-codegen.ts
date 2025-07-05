#!/usr/bin/env ts-node

import { Command } from 'commander';
import { codeWriterAgent } from '../agents/codeWriterAgent';
import { FileIOUtils } from '../utils/fileIO';
import * as path from 'path';

const program = new Command();

program
  .name('run-codegen')
  .description('Run the code generation agent')
  .version('0.1.0');

program
  .option('-t, --task <task>', 'Task description for code generation')
  .option('-i, --issue <issue>', 'Mock issue file to use (from mock-issues directory)')
  .option('-o, --output <output>', 'Output directory', 'output/generated-code')
  .option('-m, --model <model>', 'LLM model to use', 'claude')
  .action(async (options) => {
    try {
      let taskDescription: string;

      if (options.issue) {
        // Load task from mock issue file
        const issuePath = path.join(process.cwd(), 'mock-issues', `${options.issue}.json`);
        if (await FileIOUtils.fileExists(issuePath)) {
          const issueContent = await FileIOUtils.readFile(issuePath);
          const issue = JSON.parse(issueContent);
          taskDescription = `${issue.title}\n\n${issue.body}`;
        } else {
          console.error(`Mock issue file not found: ${issuePath}`);
          process.exit(1);
        }
      } else if (options.task) {
        taskDescription = options.task;
      } else {
        console.error('Either --task or --issue must be provided');
        process.exit(1);
      }

      console.log('🚀 Starting code generation...');
      console.log(`📝 Task: ${taskDescription.substring(0, 100)}...`);
      console.log(`🤖 Model: ${options.model}`);
      console.log(`📁 Output: ${options.output}`);

      // Generate code
      const result = await codeWriterAgent.generateCode({
        taskDescription,
        fileContext: 'No specific file context',
        projectStructure: 'TypeScript project with modular agent architecture'
      });

      // Ensure output directory exists
      await FileIOUtils.ensureDir(options.output);

      // Write generated files
      await FileIOUtils.writeFiles(result.files, options.output);

      console.log('✅ Code generation complete!');
      console.log(`📂 Generated ${result.files.length} file(s):`);
      
      result.files.forEach(file => {
        console.log(`   - ${file.filename}`);
      });

      if (result.comments) {
        console.log(`💬 Comments: ${result.comments}`);
      }

    } catch (error) {
      console.error('❌ Code generation failed:', error);
      process.exit(1);
    }
  });

program.parse();