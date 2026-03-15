#!/bin/bash

# 🔐 Cloudflare Workers Secrets Setup Script
# 
# This script helps you configure all required secrets for the
# Australian AI Assistant Cloudflare Worker deployment.
#
# IMPORTANT: Never put API keys in wrangler.toml [vars] section!
# Use `wrangler secret put` to store them securely (encrypted at rest).

echo "🔐 Australian AI Assistant — Secrets Setup"
echo "==========================================="
echo ""
echo "This will configure encrypted secrets for your Cloudflare Worker."
echo "You'll need the actual API key values ready."
echo ""

cd "$(dirname "$0")/../cloudflare/api-worker" || {
    echo "❌ Cannot find cloudflare/api-worker directory"
    exit 1
}

echo "📍 Working directory: $(pwd)"
echo ""

# Required secrets
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📌 REQUIRED SECRETS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "1/7 — DEEPSEEK_API_KEY (LLM for intent analysis + response generation)"
echo "      Get from: https://platform.deepseek.com/"
read -p "      Set this secret now? [y/N]: " yn
if [[ "$yn" =~ ^[Yy]$ ]]; then
    npx wrangler secret put DEEPSEEK_API_KEY
fi
echo ""

echo "2/7 — CF_ACCOUNT_ID (your Cloudflare account ID)"
echo "      Find at: https://dash.cloudflare.com/ → right sidebar"
read -p "      Set this secret now? [y/N]: " yn
if [[ "$yn" =~ ^[Yy]$ ]]; then
    npx wrangler secret put CF_ACCOUNT_ID
fi
echo ""

echo "3/7 — NSW_TRANSPORT_API_KEY (Transport for NSW real-time data)"
echo "      Get from: https://opendata.transport.nsw.gov.au/"
read -p "      Set this secret now? [y/N]: " yn
if [[ "$yn" =~ ^[Yy]$ ]]; then
    npx wrangler secret put NSW_TRANSPORT_API_KEY
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📌 OPTIONAL SECRETS (enhance functionality)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "4/7 — GOOGLE_PLACES_API_KEY (POI search: restaurants, supermarkets)"
echo "      Get from: https://console.cloud.google.com/ → Places API (New)"
read -p "      Set this secret now? [y/N]: " yn
if [[ "$yn" =~ ^[Yy]$ ]]; then
    npx wrangler secret put GOOGLE_PLACES_API_KEY
fi
echo ""

echo "5/7 — VIC_TRANSPORT_TOKEN (Victoria transport real-time data)"
echo "      Get from: https://discover.data.vic.gov.au/"
read -p "      Set this secret now? [y/N]: " yn
if [[ "$yn" =~ ^[Yy]$ ]]; then
    npx wrangler secret put VIC_TRANSPORT_TOKEN
fi
echo ""

echo "6/7 — JINA_API_KEY (web page reader for Kmart/IGA fallback search)"
echo "      Get from: https://jina.ai/reader/"
read -p "      Set this secret now? [y/N]: " yn
if [[ "$yn" =~ ^[Yy]$ ]]; then
    npx wrangler secret put JINA_API_KEY
fi
echo ""

echo "7/7 — TAVILY_API_KEY (web search for stores without direct API)"
echo "      Get from: https://tavily.com/"
read -p "      Set this secret now? [y/N]: " yn
if [[ "$yn" =~ ^[Yy]$ ]]; then
    npx wrangler secret put TAVILY_API_KEY
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Secrets setup complete!"
echo ""
echo "📋 Verify all secrets are configured:"
echo "   npx wrangler secret list"
echo ""
echo "🚀 Deploy your worker:"
echo "   npm run deploy"
echo ""
echo "📊 View live logs:"
echo "   npm run logs"
echo ""
