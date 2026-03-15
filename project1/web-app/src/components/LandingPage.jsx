import { FEATURES, TOOL_CATEGORIES, ANIMAL_AGENTS } from '../config';

const AGENT_COLORS = {
  life: '#7ba4e8',
  healthcare: '#7fd4a0',
  education: '#b898d8',
  wellness: '#f0a060',
  finance: '#5a82c4',
};

export default function LandingPage({ onStartChat }) {
  return (
    <div className="landing">
      {/* Nav */}
      <nav>
        <div className="nav-brand"><span>🦘</span> 澳知AI</div>
        <div className="nav-links">
          <a onClick={() => document.getElementById('animals')?.scrollIntoView({ behavior: 'smooth' })}>动物伙伴</a>
          <a onClick={() => document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' })}>52项工具</a>
          <a className="nav-cta" onClick={onStartChat}>立即使用</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <h1><span className="gradient">澳知AI</span> — 你的澳洲生活助手</h1>
        <p>5只澳洲动物伙伴 · 52项本地服务 · 中英双语</p>

        {/* Animal Parade */}
        <div className="animal-parade">
          {Object.entries(ANIMAL_AGENTS).map(([key, a]) => (
            <div className="animal-card" key={key} style={{ borderColor: AGENT_COLORS[key] }}>
              <div className="animal-emoji">{a.emoji}</div>
              <div className="animal-name">{a.name}</div>
              <div className="animal-role" style={{ color: AGENT_COLORS[key] }}>{a.personality}</div>
            </div>
          ))}
        </div>

        <div className="hero-stats">
          <div className="hero-stat"><div className="num">52</div><div className="label">本地工具</div></div>
          <div className="hero-stat"><div className="num">22K+</div><div className="label">知识文档</div></div>
          <div className="hero-stat"><div className="num">9,755</div><div className="label">学校数据</div></div>
          <div className="hero-stat"><div className="num">5</div><div className="label">动物伙伴</div></div>
        </div>
        <button className="try-btn" onClick={onStartChat}>🐦 开始和 Kookie 聊天</button>
      </section>

      {/* Features */}
      <section className="features" id="animals">
        <h2 className="section-title">认识你的动物伙伴</h2>
        <p className="section-sub">5位来自澳洲的动物精灵，各有专长</p>
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <div className="feat-card" key={i}>
              <div className="feat-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tools — By Animal/Agent */}
      <section className="tools-section" id="tools">
        <h2 className="section-title">52项澳洲本地服务</h2>
        <p className="section-sub">每只动物负责不同领域的工具</p>
        <div className="tool-categories">
          {TOOL_CATEGORIES.map((cat, i) => (
            <div
              className="tool-category"
              key={i}
              style={{ borderColor: AGENT_COLORS[cat.agent] || undefined }}
            >
              <div className="tool-cat-header">
                <span className="tool-cat-icon">{cat.icon}</span>
                <span className="tool-cat-title">{cat.title}</span>
                <span className="tool-cat-count">{cat.tools.length}项</span>
              </div>
              <div className="tool-cat-items">
                {cat.tools.map((tool, j) => (
                  <div
                    className="tool-tag"
                    key={j}
                    style={{ borderColor: `${AGENT_COLORS[cat.agent]}60` }}
                  >
                    {tool}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer>
        <p>© 2026 澳知AI · Made with ❤️ in Sydney, Australia</p>
        <p style={{ marginTop: 8, fontSize: '0.9em' }}>
          🐦 Kookie · 🦎 Spike · 🐨 Koko · 🐹 Quokka · 🦆 Platty
        </p>
      </footer>
    </div>
  );
}
