/**
 * Test Framework for BaseAgent
 * 
 * Tests:
 * 1. Abstract method enforcement (_getSystemPrompt must be implemented)
 * 2. Tool access control (agents can only call authorized tools)
 * 3. RAG category filtering
 * 4. Tool execution wrapper
 */

import { describe, test, expect } from 'bun:test';
import { BaseAgent } from '../../src/agents/base-agent.js';

// Mock LLM Service
class MockLLMService {
  async chat(messages) {
    return 'Test response';
  }
  
  async chatJSON(messages) {
    return JSON.stringify({
      tool_calls: [],
      rag_categories: [],
      reasoning: 'test'
    });
  }
}

// Concrete test agent that implements _getSystemPrompt
class TestAgent extends BaseAgent {
  _getSystemPrompt() {
    return 'Test system prompt';
  }
}

// Invalid agent that doesn't implement _getSystemPrompt
class InvalidAgent extends BaseAgent {
  // No _getSystemPrompt implementation
}

describe('BaseAgent', () => {
  test('should enforce _getSystemPrompt implementation', () => {
    const mockLLM = new MockLLMService();
    const mockEnv = {};
    const invalidAgent = new InvalidAgent(mockLLM, mockEnv, [], []);
    
    expect(() => {
      invalidAgent._getSystemPrompt();
    }).toThrow('must implement _getSystemPrompt');
  });
  
  test('should allow valid agent to call _getSystemPrompt', () => {
    const mockLLM = new MockLLMService();
    const mockEnv = {};
    const testAgent = new TestAgent(mockLLM, mockEnv, [], []);
    
    const prompt = testAgent._getSystemPrompt();
    expect(prompt).toBe('Test system prompt');
  });
  
  test('should initialize with tools and RAG categories', () => {
    const mockLLM = new MockLLMService();
    const mockEnv = {};
    const tools = ['weather', 'supermarket'];
    const ragCategories = ['living', 'transport'];
    
    const agent = new TestAgent(mockLLM, mockEnv, tools, ragCategories);
    
    expect(agent.tools).toEqual(tools);
    expect(agent.ragCategories).toEqual(ragCategories);
  });
  
  test.todo('should reject unauthorized tool calls');
  test.todo('should execute authorized tools successfully');
  test.todo('should filter RAG categories correctly');
  test.todo('should process() method orchestrates all steps');
});
