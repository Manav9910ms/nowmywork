import SiteNav from '@/components/site-nav';
import HomepageActions from '@/components/homepage-actions';

const brandLogo = 'https://raw.githubusercontent.com/Manav9910ms/nowmywork/main/icon.png';
const steps = [
  { number: '01', title: 'Post the work', text: 'Describe the project, skills, budget, deadline, and the kind of freelancer you need.' },
  { number: '02', title: 'Matching is being redesigned', text: 'We are rebuilding private matching. Automatic offers are paused while we improve the experience.' },
  { number: '03', title: 'Review freelancer profiles', text: 'Freelancers complete a profile and approval review before they can access freelancer features.' },
];
const features = [
  ['No bidding', 'Stop wasting hours writing proposals that may never get read.'],
  ['Matching redesign', 'We are reworking how projects are matched to relevant freelancer profiles.'],
  ['Client priority', 'Choose Quality, Balanced, or Budget/Speed when posting a project.'],
  ['Clear fees', 'A simple transaction model keeps the platform aligned with successful work.'],
];
export default function Home() { return <main>
  <SiteNav />
  <section id="top" className="hero shell"><div className="hero-copy"><div className="eyebrow"><span className="live-dot"/> A better way to freelance</div><h1>Work should find you.</h1><p className="hero-text">NowMyWork is being built to make freelance work simpler. Project posting is available now while we redesign private freelancer matching and review the freelancer onboarding experience.</p><HomepageActions placement="hero" /><div className="trust-row"><span>Built for</span><strong>Clients</strong><i>×</i><strong>Freelancers</strong></div></div>
    <div className="matching-card" aria-label="Example matching flow"><div className="card-topline"><span>MATCHING REDESIGN</span><span>PRODUCT UPDATE</span></div><div className="job-block"><div className="mini-label">CURRENT STATUS</div><h2>Private matching is being redesigned</h2><div className="chips"><span>Skills</span><span>Experience</span><span>Reviewed profiles</span></div></div><div className="match-divider"/><div className="match-heading"><span>Current status</span><strong>In progress</strong></div><div className="freelancer-list"><div className="freelancer"><div className="avatar">1</div><div className="freelancer-main"><strong>Project posting</strong><span>Available for clients</span></div></div><div className="freelancer"><div className="avatar">2</div><div className="freelancer-main"><strong>Freelancer applications</strong><span>Profile plus admin review</span></div></div><div className="freelancer"><div className="avatar">3</div><div className="freelancer-main"><strong>Automatic offers</strong><span>Paused until redesign</span></div></div></div><div className="card-note">No new automated matches are being generated</div></div>
  </section>
  <section id="how" className="section shell"><div className="section-heading"><div><div className="eyebrow muted">HOW IT WORKS</div><h2>Less bidding. More building.</h2></div><p>Designed around one simple idea: the marketplace should do more of the matching work for you.</p></div><div className="steps-grid">{steps.map((step) => <article className="step" key={step.number}><span className="step-number">{step.number}</span><h3>{step.title}</h3><p>{step.text}</p></article>)}</div></section>
  <section id="why" className="section feature-section"><div className="shell"><div className="section-heading split"><div><div className="eyebrow muted">WHY NOWMYWORK</div><h2>A marketplace that works like a matcher, not a job board.</h2></div><p>Give clients less to compare and freelancers less to chase. Keep the human value while removing the busywork.</p></div><div className="features-grid">{features.map(([title,text],index) => <article className="feature" key={title}><span className="feature-index">0{index+1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>
  <section id="start" className="cta shell"><div className="cta-brand"><img src={brandLogo} alt="NowMyWork" className="cta-logo"/></div><div><div className="eyebrow">MATCHING REDESIGN</div><h2>Post work. Build a better way to freelance.</h2><p>Project posting is available while private matching is redesigned. Freelancer applications are reviewed before freelancer features are enabled.</p></div><HomepageActions placement="cta" /></section>
  <footer className="footer shell"><span>© {new Date().getFullYear()} NowMyWork</span><span>Work finds you.</span><a href="mailto:team@nowmywork.com">team@nowmywork.com</a><span className="footer-socials"><a href="https://www.youtube.com/@nowmywork" target="_blank" rel="noreferrer">YouTube</a><a href="https://www.instagram.com/nowmywork" target="_blank" rel="noreferrer">Instagram</a></span></footer>
</main>; }
