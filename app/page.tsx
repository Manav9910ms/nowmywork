import Link from 'next/link';

const brandIcon = 'https://raw.githubusercontent.com/Manav9910ms/nowmywork/main/icon.png';
const brandLogo = 'https://raw.githubusercontent.com/Manav9910ms/nowmywork/main/logo.png';

const steps = [
  { number: '01', title: 'Post the work', text: 'Describe the project, skills, budget, deadline, and the kind of freelancer you need.' },
  { number: '02', title: 'We match it', text: 'NowMyWork scores eligible freelancers and privately sends the opportunity to the best matches.' },
  { number: '03', title: 'Someone accepts', text: 'The right freelancer accepts the job. No proposal war. No endless comparison.' },
];

const features = [
  ['No bidding', 'Stop wasting hours writing proposals that may never get read.'],
  ['Smart matching', 'Projects reach freelancers whose skills, availability, budget and track record fit.'],
  ['Client priority', 'Choose Quality, Balanced, or Budget/Speed when posting a project.'],
  ['Clear fees', 'A simple transaction model keeps the platform aligned with successful work.'],
];

export default function Home() {
  return (
    <main>
      <nav className="nav shell">
        <a className="brand" href="#top" aria-label="NowMyWork home"><img src={brandIcon} alt="" className="brand-logo" /><span>NowMyWork</span></a>
        <div className="nav-links"><a href="#how">How it works</a><a href="#why">Why NowMyWork</a><a href="#start">Get started</a></div>
        <div className="nav-actions"><Link className="ghost-btn" href="/signin">Sign in</Link><Link className="dark-btn" href="/signup">Join NowMyWork</Link></div>
      </nav>

      <section id="top" className="hero shell">
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> A better way to freelance</div>
          <h1>Work should find you.</h1>
          <p className="hero-text">NowMyWork replaces endless freelance bidding with smart, private matching. Clients post once. The right freelancers get the opportunity. Work starts faster.</p>
          <div className="hero-actions"><Link className="primary-btn" href="/signup">I need a freelancer <span>→</span></Link><Link className="secondary-btn" href="/signup">I want work <span>→</span></Link></div>
          <div className="trust-row"><span>Built for</span><strong>Clients</strong><i>×</i><strong>Freelancers</strong></div>
        </div>

        <div className="matching-card" aria-label="Example matching flow">
          <div className="card-topline"><span>LIVE MATCH</span><span>Job #NM-1042</span></div>
          <div className="job-block"><div className="mini-label">PROJECT</div><h2>Build a modern SaaS dashboard</h2><div className="chips"><span>Next.js</span><span>TypeScript</span><span>UI/UX</span></div></div>
          <div className="match-divider" /><div className="match-heading"><span>Top matches</span><strong>10</strong></div>
          <div className="freelancer-list">{[['A','Alex Morgan','98% match','Quality'],['S','Sam Patel','95% match','Balanced'],['R','Riya Sharma','93% match','Fast']].map(([initial,name,score,mode]) => <div className="freelancer" key={name}><div className="avatar">{initial}</div><div className="freelancer-main"><strong>{name}</strong><span>{score}</span></div><span className="mode-pill">{mode}</span></div>)}</div>
          <div className="card-note">Private offer sent · waiting for acceptance</div>
        </div>
      </section>

      <section id="how" className="section shell"><div className="section-heading"><div><div className="eyebrow muted">HOW IT WORKS</div><h2>Less bidding. More building.</h2></div><p>Designed around one simple idea: the marketplace should do more of the matching work for you.</p></div><div className="steps-grid">{steps.map((step) => <article className="step" key={step.number}><span className="step-number">{step.number}</span><h3>{step.title}</h3><p>{step.text}</p></article>)}</div></section>

      <section id="why" className="section feature-section"><div className="shell"><div className="section-heading split"><div><div className="eyebrow muted">WHY NOWMYWORK</div><h2>A marketplace that works like a matcher, not a job board.</h2></div><p>Give clients less to compare and freelancers less to chase. Keep the human value while removing the busywork.</p></div><div className="features-grid">{features.map(([title,text],index) => <article className="feature" key={title}><span className="feature-index">0{index+1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>

      <section id="start" className="cta shell"><div className="cta-brand"><img src={brandLogo} alt="NowMyWork" className="cta-logo" /></div><div><div className="eyebrow">COMING TO LIFE</div><h2>Post work. Get matched. Get moving.</h2><p>NowMyWork is being built around a faster path from “I need help” to “the right person has it.”</p></div><div className="cta-actions"><Link className="primary-btn light" href="/signup">Post a project <span>→</span></Link><Link className="secondary-btn light-outline" href="/signup">Join as a freelancer</Link></div></section>

      <footer className="footer shell"><span>© {new Date().getFullYear()} NowMyWork</span><span>Work finds you.</span></footer>
    </main>
  );
}
