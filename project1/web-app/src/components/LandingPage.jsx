import { FEATURES, TOOL_CATEGORIES } from '../config';

export default function LandingPage({ onStartChat }) {
  return (
    <div className="landing">
      {/* Nav */}
      <nav>
        <div className="nav-brand"><span>🦘</span> 澳知AI</div>
        <div className="nav-links">
          <a onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>功能</a>
          <a onClick={() => document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' })}>52项工具</a>
          <a className="nav-cta" onClick={onStartChat}>立即使用</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <h1><span className="gradient">澳知AI</span> — 你的澳洲生活助手</h1>
        <p>52项本地服务工具 · 22,000+政府知识库 · 中英双语<br />覆盖交通、租房、税务、学校、Medicare、防诈骗等</p>
        <div className="hero-stats">
          <div className="hero-stat"><div className="num">52</div><div className="label">本地工具</div></div>
          <div className="hero-stat"><div className="num">22K+</div><div className="label">知识文档</div></div>
          <div className="hero-stat"><div className="num">749</div><div className="label">邮编租金</div></div>
          <div className="hero-stat"><div className="num">9,755</div><div className="label">学校数据</div></div>
        </div>
        <button className="try-btn" onClick={onStartChat}>💬 立即使用对话</button>
      </section>

      {/* Features */}
      <section className="features" id="features">
        <h2 className="section-title">为什么选择澳知AI？</h2>
        <p className="section-sub">不只是聊天机器人，而是真正懂澳洲的智能助手</p>
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

      {/* Tools — Categorized */}
      <section className="tools-section" id="tools">
        <h2 className="section-title">52项澳洲本地服务</h2>
        <p className="section-sub">覆盖留学生、华人移民、游客的全部生活场景</p>
        <div className="tool-categories">
          {TOOL_CATEGORIES.map((cat, i) => (
            <div className="tool-category" key={i}>
              <div className="tool-cat-header">
                <span className="tool-cat-icon">{cat.icon}</span>
                <span className="tool-cat-title">{cat.title}</span>
                <span className="tool-cat-count">{cat.tools.length}项</span>
              </div>
              <div className="tool-cat-items">
                {cat.tools.map((tool, j) => (
                  <div className="tool-tag" key={j}>{tool}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer>
        <p>© 2026 澳知AI · Made with ❤️ in Sydney, Australia</p>
        <p style={{ marginTop: 8 }}>
          <a href="mailto:support@aozhi.app">联系我们</a> · <a href="/privacy">隐私政策</a> · <a href="/terms">服务条款</a>
        </p>
      </footer>
    </div>
  );
}
