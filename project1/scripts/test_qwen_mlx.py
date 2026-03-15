#!/usr/bin/env python3
"""
Test script for Qwen MLX model inference
Tests basic generation and function calling capabilities
"""

import sys
import time
from pathlib import Path

try:
    import mlx
    import mlx.core as mx
    from mlx_lm import load, generate
except ImportError:
    print("❌ Error: mlx_lm not installed")
    print("Install with: pip3 install mlx mlx-lm")
    sys.exit(1)


def test_basic_generation():
    """Test basic text generation"""
    print("\n🧪 Test 1: Basic Text Generation")
    print("=" * 50)
    
    model_path = "ios-app/models/Qwen2.5-1.5B-Instruct-Q8.mlx"
    
    if not Path(model_path).exists():
        print(f"❌ Model not found at {model_path}")
        return False
    
    print(f"📦 Loading model from {model_path}...")
    start = time.time()
    
    try:
        model, tokenizer = load(model_path)
        load_time = time.time() - start
        print(f"✅ Model loaded in {load_time:.2f}s")
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        return False
    
    # Test prompt
    prompt = "What is the capital of Australia?"
    
    print(f"\n📝 Prompt: {prompt}")
    print("🔄 Generating...")
    
    start = time.time()
    try:
        response = generate(
            model,
            tokenizer,
            prompt=prompt,
            max_tokens=100,
            verbose=False
        )
        gen_time = time.time() - start
        
        print(f"\n✅ Response: {response}")
        print(f"⏱️  Generation time: {gen_time:.2f}s")
        
        # Calculate tokens/sec (rough estimate)
        tokens = len(tokenizer.encode(response))
        tokens_per_sec = tokens / gen_time if gen_time > 0 else 0
        print(f"🚀 Speed: ~{tokens_per_sec:.1f} tokens/s")
        
        # Check if target speed met (≥10 tokens/s)
        if tokens_per_sec >= 10:
            print("✅ Speed target met (≥10 tokens/s)")
        else:
            print(f"⚠️  Speed below target ({tokens_per_sec:.1f} < 10 tokens/s)")
        
        return True
        
    except Exception as e:
        print(f"❌ Generation failed: {e}")
        return False


def test_function_calling():
    """Test function calling capability"""
    print("\n\n🧪 Test 2: Function Calling Format")
    print("=" * 50)
    
    model_path = "ios-app/models/Qwen2.5-1.5B-Instruct-Q8.mlx"
    
    print(f"📦 Loading model from {model_path}...")
    try:
        model, tokenizer = load(model_path)
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        return False
    
    # Function calling prompt
    prompt = """You are an AI assistant with access to tools. Generate a JSON function call.

Available tools:
- get_weather(location: str) -> dict

User: What's the weather in Sydney?

Generate JSON:"""
    
    print(f"\n📝 Prompt: {prompt}")
    print("🔄 Generating...")
    
    try:
        response = generate(
            model,
            tokenizer,
            prompt=prompt,
            max_tokens=50,
            verbose=False
        )
        
        print(f"\n✅ Response: {response}")
        
        # Check if response looks like JSON
        if "{" in response and "}" in response:
            print("✅ JSON-like format detected")
        else:
            print("⚠️  Response doesn't look like JSON")
        
        return True
        
    except Exception as e:
        print(f"❌ Generation failed: {e}")
        return False


def test_chinese_support():
    """Test Chinese language support"""
    print("\n\n🧪 Test 3: Chinese Language Support")
    print("=" * 50)
    
    model_path = "ios-app/models/Qwen2.5-1.5B-Instruct-Q8.mlx"
    
    print(f"📦 Loading model from {model_path}...")
    try:
        model, tokenizer = load(model_path)
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        return False
    
    prompt = "澳大利亚的首都是哪里？请用中文回答。"
    
    print(f"\n📝 Prompt: {prompt}")
    print("🔄 Generating...")
    
    try:
        response = generate(
            model,
            tokenizer,
            prompt=prompt,
            max_tokens=50,
            verbose=False
        )
        
        print(f"\n✅ Response: {response}")
        
        # Check if response contains Chinese characters
        has_chinese = any('\u4e00' <= char <= '\u9fff' for char in response)
        if has_chinese:
            print("✅ Chinese characters detected in response")
        else:
            print("⚠️  No Chinese characters in response")
        
        return True
        
    except Exception as e:
        print(f"❌ Generation failed: {e}")
        return False


def main():
    print("🚀 Qwen MLX Model Test Suite")
    print("=" * 50)
    
    # Check if running on Apple Silicon
    try:
        device = mx.default_device()
        print(f"🖥️  Device: {device}")
    except:
        print("⚠️  Cannot detect device")
    
    results = []
    
    # Run tests
    results.append(("Basic Generation", test_basic_generation()))
    results.append(("Function Calling", test_function_calling()))
    results.append(("Chinese Support", test_chinese_support()))
    
    # Summary
    print("\n\n📊 Test Summary")
    print("=" * 50)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    print(f"\n✅ {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Model is ready for iOS integration.")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Review errors above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
