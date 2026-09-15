import { useState, useEffect, useRef, useCallback } from "react";
import {
  BrowserRouter, Routes, Route, Link, useNavigate, useLocation, useParams
} from "react-router-dom";
import {
  Building2, Search, Send, Globe, Loader2, FileText, ArrowUpRight,
  XCircle, ExternalLink, ShieldCheck, Copy, Check, Menu, X,
  Sparkles, Layers, ChevronRight, Clock, Database,
  Cpu, BarChart3, BookOpen, Filter, Eye, Star, AlertTriangle, RefreshCw
} from "lucide-react";

const API_BASE =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:8000"
    : import.meta.env.VITE_API_URL;

interface CompanyItem {
  id: string;
  name: string;
  website_url: string;
  status: string;
  created_at: string;
}
interface Citation {
  index: number;
  url: string;
  title: string;
  source_type: string;
  section_header: string;
  snippet?: string;
  relevance_score?: number;
  chunk_id?: string;
}
interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  citations?: Citation[];
  ts?: string;
}
interface JobStatus {
  status: string;
  pages_discovered?: number;
  pages_processed?: number;
  logs?: string;
  error?: string;
}

function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="18" r="17" fill="#F4C542" />
      <circle cx="18" cy="18" r="12" stroke="#191817" strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="18" cy="18" r="5" fill="#191817" />
      <line x1="18" y1="6" x2="18" y2="13" stroke="#191817" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="18" y1="23" x2="18" y2="30" stroke="#191817" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6" y1="18" x2="13" y2="18" stroke="#191817" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="23" y1="18" x2="30" y2="18" stroke="#191817" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function GlobalNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = [
    { label: "Home", path: "/" },
    { label: "Research", path: "/research" },
    { label: "Companies", path: "/companies" },
    { label: "Sources", path: "/sources" },
    { label: "History", path: "/history" },
  ];
  const isActive = (p: string) => p === "/" ? location.pathname === "/" : location.pathname.startsWith(p);
  return (
    <header className="ds-navbar">
      <div className="ds-navbar-inner">
        <Link to="/" style={{ display:"flex", alignItems:"center", gap:10, textDecoration:"none" }}>
          <BrandMark size={34} />
          <span className="font-editorial" style={{ fontSize:20, fontWeight:800, color:"#191817", letterSpacing:"-0.02em" }}>
            Deep<span style={{ color:"#7C8460" }}>Scout</span>
          </span>
        </Link>
        <nav className="ds-nav-pill-bar" id="desk-nav">
          {navItems.map(item => (
            <Link key={item.path} to={item.path} className={`ds-nav-link${isActive(item.path) ? " active" : ""}`}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div id="desk-cta">
          <button onClick={() => navigate("/research")} className="btn-gold" style={{ padding:"9px 20px", fontSize:12 }}>
            New Research <ArrowUpRight size={14} />
          </button>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} id="mob-btn"
          style={{ padding:8, border:"none", background:"rgba(246,241,231,0.8)", borderRadius:9999, cursor:"pointer", display:"flex" }}>
          {mobileOpen ? <X size={18} color="#191817"/> : <Menu size={18} color="#191817"/>}
        </button>
      </div>
      {mobileOpen && (
        <div style={{ margin:"8px auto 0", maxWidth:1280, background:"rgba(255,255,255,0.96)", backdropFilter:"blur(24px)",
          border:"1px solid rgba(255,255,255,0.9)", borderRadius:28, padding:20, display:"flex", flexDirection:"column", gap:6,
          boxShadow:"0 16px 40px -8px rgba(25,24,23,0.12)" }}>
          {navItems.map(item => (
            <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
              className={`ds-nav-link${isActive(item.path) ? " active" : ""}`}
              style={{ padding:"10px 18px", fontSize:14, borderRadius:16 }}>
              {item.label}
            </Link>
          ))}
          <button onClick={() => { navigate("/research"); setMobileOpen(false); }} className="btn-gold" style={{ justifyContent:"center", marginTop:8 }}>
            Start New Research <ArrowUpRight size={15} />
          </button>
        </div>
      )}
      <style>{`
        #desk-nav, #desk-cta { display: none; }
        #mob-btn { display: flex; }
        @media(min-width:768px) {
          #desk-nav, #desk-cta { display: flex !important; }
          #mob-btn { display: none !important; }
        }
      `}</style>
    </header>
  );
}

const PIPELINE_STAGES = [
  { num:"01", label:"DISCOVER",  icon: Globe,     desc:"Firecrawl crawls the company website — extracting structured HTML, headings, lists, tables, and paragraphs." },
  { num:"02", label:"CLEAN",     icon: Filter,    desc:"Content cleaning strips cookie banners, navigation noise, boilerplate, and irrelevant legal text." },
  { num:"03", label:"CHUNK",     icon: Layers,    desc:"Structure-aware chunking splits documents by semantic boundaries — headings, sections, and paragraph groups." },
  { num:"04", label:"EMBED",     icon: Cpu,       desc:"Local BAAI/bge-base-en-v1.5 creates 768-dimensional embeddings on NVIDIA RTX 3050 via CUDA." },
  { num:"05", label:"RETRIEVE",  icon: Database,  desc:"Hybrid retrieval: pgvector cosine similarity + PostgreSQL FTS, fused via Reciprocal Rank Fusion (RRF)." },
  { num:"06", label:"ANSWER",    icon: Sparkles,  desc:"Gemini synthesizes grounded answers strictly from retrieved evidence — every claim is source-linked." },
];

function HomePage() {
  const navigate = useNavigate();
  const [hoveredStage, setHoveredStage] = useState<number | null>(null);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  useEffect(() => {
    fetch(`${API_BASE}/api/companies`).then(r => r.ok ? r.json() : []).then(d => { if (Array.isArray(d)) setCompanies(d.slice(0, 4)); }).catch(() => {});
  }, []);

  return (
    <div style={{ padding:"0 16px 60px", maxWidth:1300, margin:"0 auto" }}>
      {/* HERO */}
      <div className="ds-world" style={{ padding:"48px 40px 40px", marginBottom:24, position:"relative" }}>
        <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none", opacity:0.15 }} viewBox="0 0 1200 560" fill="none">
          <circle cx="950" cy="120" r="280" stroke="#F4C542" strokeWidth="1.5" strokeDasharray="6 6"/>
          <circle cx="950" cy="120" r="200" stroke="#7C8460" strokeWidth="1"/>
          <path d="M-60,440 Q300,160 700,440 T1260,200" stroke="#E9B82E" strokeWidth="2" fill="none"/>
        </svg>

        <div id="hero-grid" style={{ display:"grid", gridTemplateColumns:"1fr", gap:40, alignItems:"center", position:"relative", zIndex:1 }}>
          {/* Left */}
          <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 14px", borderRadius:9999, background:"rgba(255,255,255,0.7)", border:"1px solid rgba(255,255,255,0.9)", fontSize:11, fontWeight:700, color:"#7C8460", width:"fit-content" }}>
              <Sparkles size={13} color="#E9B82E"/> AI COMPANY INTELLIGENCE
            </div>
            <h1 className="font-editorial" style={{ fontSize:"clamp(36px,5vw,64px)", fontWeight:800, color:"#191817", lineHeight:1.08, letterSpacing:"-0.02em" }}>
              Research any company.<br/>
              <em style={{ fontStyle:"italic", fontWeight:400, color:"#7C8460" }}>Understand the evidence.</em>
            </h1>
            <p style={{ fontSize:15, color:"#5C5850", lineHeight:1.72, maxWidth:480, fontFamily:"'Manrope',sans-serif" }}>
              DeepScout investigates company websites, builds a searchable evidence base, and generates grounded answers backed by real, retrievable sources.
            </p>
            <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
              <button onClick={() => navigate("/research")} className="btn-gold" style={{ padding:"14px 32px", fontSize:14 }}>
                START RESEARCH <ArrowUpRight size={16}/>
              </button>
              <button onClick={() => navigate("/companies")} className="btn-ghost" style={{ padding:"13px 28px", fontSize:14 }}>
                Explore Companies
              </button>
            </div>
            <div style={{ display:"flex", gap:28, flexWrap:"wrap", paddingTop:8 }}>
              {[["768d","Local BGE Embeddings"],["RRF","Hybrid Retrieval Fusion"],["CUDA","GPU Accelerated"]].map(([v,d]) => (
                <div key={v} style={{ display:"flex", flexDirection:"column", gap:2 }}>
                  <span className="font-editorial" style={{ fontSize:22, fontWeight:700, color:"#191817" }}>{v}</span>
                  <span style={{ fontSize:10, fontWeight:600, color:"#77736B", textTransform:"uppercase", letterSpacing:"0.06em" }}>{d}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Illustration */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
            <div style={{ width:"100%", maxWidth:380, aspectRatio:"1/1", position:"relative" }}>
              <div style={{ position:"absolute", inset:"10%", background:"radial-gradient(circle, rgba(244,197,66,0.25) 0%, rgba(124,132,96,0.12) 55%, transparent 80%)", borderRadius:"50%", filter:"blur(28px)" }} className="anim-pulse-soft"/>
              <svg viewBox="0 0 400 400" style={{ width:"100%", height:"100%", position:"relative", zIndex:2 }} fill="none">
                <circle cx="200" cy="200" r="168" stroke="#F4C542" strokeWidth="2" strokeDasharray="8 10" opacity="0.5" className="anim-spin-slow"/>
                <circle cx="200" cy="200" r="138" stroke="#7C8460" strokeWidth="1.2" opacity="0.3"/>
                <ellipse cx="200" cy="290" rx="50" ry="20" fill="rgba(124,132,96,0.12)"/>
                <path d="M178 308 Q178 252, 222 252 Q222 308 178 308 Z" fill="#252321" opacity="0.9"/>
                <path d="M185 268 L200 278 L215 268" stroke="#F4C542" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="200" cy="210" r="44" fill="#F4C542"/>
                <path d="M160 200 Q162 170 200 165 Q238 170 240 200" fill="#252321"/>
                <path d="M160 200 L156 212 L160 209" fill="#252321"/>
                <path d="M240 200 L244 212 L240 209" fill="#252321"/>
                <ellipse cx="189" cy="208" rx="5.5" ry="6.5" fill="#191817"/>
                <ellipse cx="211" cy="208" rx="5.5" ry="6.5" fill="#191817"/>
                <circle cx="191" cy="206" r="2" fill="white"/>
                <circle cx="213" cy="206" r="2" fill="white"/>
                <path d="M180 207 L185 207 M206 207 L212 207" stroke="#191817" strokeWidth="1.5"/>
                <rect x="183" y="202" width="12" height="9" rx="4" fill="none" stroke="#191817" strokeWidth="1.5"/>
                <rect x="205" y="202" width="12" height="9" rx="4" fill="none" stroke="#191817" strokeWidth="1.5"/>
                <path d="M194 222 Q200 226 206 222" stroke="#191817" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
                <path d="M196 165 Q192 150 197 143 Q203 152 200 165" fill="#252321"/>
                <g className="anim-float" style={{ transformOrigin:"110px 130px" }}>
                  <rect x="65" y="108" width="82" height="50" rx="13" fill="white" opacity="0.92" stroke="#E5DFD3"/>
                  <rect x="77" y="120" width="38" height="5" rx="2.5" fill="#F4C542"/>
                  <rect x="77" y="130" width="54" height="3" rx="1.5" fill="#E5DFD3"/>
                  <rect x="77" y="138" width="44" height="3" rx="1.5" fill="#E5DFD3"/>
                </g>
                <g className="anim-float-down" style={{ transformOrigin:"308px 158px" }}>
                  <rect x="256" y="132" width="88" height="54" rx="13" fill="white" opacity="0.92" stroke="#E5DFD3"/>
                  <rect x="268" y="144" width="44" height="5" rx="2.5" fill="#7C8460"/>
                  <rect x="268" y="154" width="60" height="3" rx="1.5" fill="#E5DFD3"/>
                  <rect x="268" y="162" width="48" height="3" rx="1.5" fill="#E5DFD3"/>
                  <rect x="268" y="170" width="32" height="3" rx="1.5" fill="#F4C542" opacity="0.6"/>
                </g>
                <g className="anim-float" style={{ transformOrigin:"78px 308px", animationDelay:"1.2s" }}>
                  <rect x="48" y="288" width="70" height="42" rx="12" fill="white" opacity="0.85" stroke="#E5DFD3"/>
                  <rect x="58" y="298" width="34" height="4" rx="2" fill="#F4C542"/>
                  <rect x="58" y="307" width="46" height="3" rx="1.5" fill="#E5DFD3"/>
                  <rect x="58" y="315" width="36" height="3" rx="1.5" fill="#E5DFD3"/>
                </g>
                <path d="M165 210 L147 158" stroke="#F4C542" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.45"/>
                <path d="M238 210 L256 172" stroke="#7C8460" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.45"/>
                <path d="M180 252 L118 300" stroke="#E9B82E" strokeWidth="1" strokeDasharray="4 4" opacity="0.35"/>
                <circle cx="306" cy="96" r="15" fill="#7C8460" opacity="0.85"/>
                <text x="306" y="102" textAnchor="middle" fill="white" fontSize="9" fontWeight="700">BGE</text>
                <circle cx="100" cy="76" r="12" fill="#F4C542" opacity="0.85"/>
                <text x="100" y="81" textAnchor="middle" fill="#191817" fontSize="9" fontWeight="700">RAG</text>
              </svg>
              <div className="ds-card anim-float" style={{ position:"absolute", top:-6, left:-14, padding:"10px 14px", display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:10, background:"#F4C542", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Database size={16} color="#191817"/>
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:"#191817" }}>pgvector</div>
                  <div style={{ fontSize:10, color:"#77736B" }}>Neon PostgreSQL</div>
                </div>
              </div>
              <div className="ds-card anim-float-down" style={{ position:"absolute", bottom:6, right:-18, padding:"10px 14px", display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:10, background:"#7C8460", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Cpu size={16} color="white"/>
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:"#191817" }}>768d Local</div>
                  <div style={{ fontSize:10, color:"#77736B" }}>CUDA Embeddings</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Strip */}
        <div id="feat-strip" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginTop:36, paddingTop:28, borderTop:"1px solid rgba(229,223,211,0.8)", position:"relative", zIndex:1 }}>
          {[
            { icon:Globe,       title:"Firecrawl Crawl",  desc:"Full website extraction" },
            { icon:Cpu,         title:"Local BGE CUDA",   desc:"768d GPU vector index" },
            { icon:Database,    title:"pgvector Hybrid",  desc:"FTS + cosine via RRF" },
            { icon:ShieldCheck, title:"Gemini Grounded",  desc:"Strict citation synthesis" },
          ].map((f, i) => {
            const Ic = f.icon;
            return (
              <div key={i} className="ds-card" style={{ padding:"18px 16px", display:"flex", flexDirection:"column", gap:8 }}>
                <div style={{ width:34, height:34, borderRadius:10, background:"rgba(246,241,231,0.9)", border:"1px solid rgba(229,223,211,0.7)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Ic size={16} color="#7C8460"/>
                </div>
                <div style={{ fontSize:12, fontWeight:700, color:"#191817" }}>{f.title}</div>
                <div style={{ fontSize:11, color:"#77736B" }}>{f.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PIPELINE SECTION */}
      <div style={{ marginBottom:24 }}>
        <div className="ds-world" style={{ padding:"40px" }}>
          <div style={{ textAlign:"center", marginBottom:32 }}>
            <div className="ds-label" style={{ marginBottom:8 }}>Intelligence Pipeline</div>
            <h2 className="font-editorial" style={{ fontSize:"clamp(28px,3.5vw,42px)", fontWeight:700, color:"#191817" }}>
              From website to intelligence.
            </h2>
            <p style={{ fontSize:14, color:"#5C5850", marginTop:10, maxWidth:500, margin:"10px auto 0" }}>
              Every answer is grounded in real pages — hover each stage to learn more.
            </p>
          </div>
          <div id="pipeline-stages" style={{ display:"flex", alignItems:"stretch", gap:0, overflowX:"auto", paddingBottom:4 }}>
            {PIPELINE_STAGES.map((stage, i) => {
              const Ic = stage.icon;
              const isH = hoveredStage === i;
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", flex:1, minWidth:72 }}>
                  <div className={`ds-step${isH ? " active" : ""}`} style={{ flex:1, position:"relative", cursor:"default" }}
                    onMouseEnter={() => setHoveredStage(i)} onMouseLeave={() => setHoveredStage(null)}>
                    <div style={{ width:36, height:36, borderRadius:"50%", background:isH?"rgba(25,24,23,0.12)":"rgba(124,132,96,0.1)", display:"flex", alignItems:"center", justifyContent:"center", transition:"background 0.2s" }}>
                      <Ic size={16} color={isH?"#191817":"#7C8460"}/>
                    </div>
                    <span style={{ fontSize:10, fontWeight:800, color:isH?"#191817":"#7C8460", letterSpacing:"0.05em" }}>{stage.num}</span>
                    <span style={{ fontSize:10, fontWeight:700, color:isH?"#191817":"#252321", textAlign:"center", lineHeight:1.3 }}>{stage.label}</span>
                    {isH && (
                      <div style={{ position:"absolute", bottom:"calc(100% + 12px)", left:"50%", transform:"translateX(-50%)", background:"#191817", color:"white", borderRadius:16, padding:"12px 16px", fontSize:12, lineHeight:1.6, width:200, textAlign:"center", zIndex:10, boxShadow:"0 8px 24px rgba(25,24,23,0.22)" }}>
                        {stage.desc}
                        <div style={{ position:"absolute", bottom:-6, left:"50%", transform:"translateX(-50%) rotate(45deg)", width:12, height:12, background:"#191817", borderRadius:3 }}/>
                      </div>
                    )}
                  </div>
                  {i < PIPELINE_STAGES.length - 1 && <div className="ds-pipe-line" style={{ minWidth:10 }}/>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* FEATURE CARDS */}
      <div style={{ marginBottom:24 }}>
        <div className="ds-world" style={{ padding:"40px" }}>
          <div style={{ textAlign:"center", marginBottom:32 }}>
            <div className="ds-label" style={{ marginBottom:8 }}>Why DeepScout</div>
            <h2 className="font-editorial" style={{ fontSize:"clamp(26px,3.5vw,38px)", fontWeight:700, color:"#191817" }}>Built around evidence.</h2>
          </div>
          <div id="feat-cards" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20 }}>
            {[
              { icon:ShieldCheck, bg:"#FEF3C7",               ic:"#92400E", title:"Source-Grounded",
                desc:"Every answer traces back to retrieved, vector-matched evidence. No hallucination. Pure grounded intelligence." },
              { icon:Cpu,         bg:"rgba(124,132,96,0.10)", ic:"#7C8460", title:"Local Embeddings",
                desc:"BGE embeddings run on your local GPU via CUDA. Your data stays private. No external embedding API calls." },
              { icon:BarChart3,   bg:"#D1FAE5",               ic:"#065F46", title:"Hybrid Retrieval",
                desc:"Cosine similarity + PostgreSQL full-text search fused via Reciprocal Rank Fusion (RRF) for superior recall." },
            ].map((card, i) => {
              const Ic = card.icon;
              return (
                <div key={i} className="ds-card-feat">
                  <div style={{ width:48, height:48, borderRadius:16, background:card.bg, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:16 }}>
                    <Ic size={22} color={card.ic}/>
                  </div>
                  <h3 className="font-editorial" style={{ fontSize:17, fontWeight:700, color:"#191817", marginBottom:8 }}>{card.title}</h3>
                  <p style={{ fontSize:13, color:"#5C5850", lineHeight:1.7 }}>{card.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RECENT RESEARCH */}
      {companies.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <div className="ds-world" style={{ padding:"40px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
              <div>
                <div className="ds-label" style={{ marginBottom:6 }}>Research Directory</div>
                <h2 className="font-editorial" style={{ fontSize:"clamp(22px,3vw,32px)", fontWeight:700, color:"#191817" }}>Recent Research</h2>
              </div>
              <button onClick={() => navigate("/companies")} className="btn-ghost" style={{ fontSize:12, padding:"9px 20px" }}>
                View All <ChevronRight size={14}/>
              </button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:18 }}>
              {companies.map(c => (
                <div key={c.id} className="ds-card ds-card-hover" style={{ padding:"22px", cursor:"pointer", display:"flex", flexDirection:"column", gap:12 }}
                  onClick={() => navigate(`/research/${c.id}`)}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span className="ds-badge ds-badge-green">● READY</span>
                    <ArrowUpRight size={15} color="#7C8460"/>
                  </div>
                  <h3 className="font-editorial" style={{ fontSize:15, fontWeight:700, color:"#191817", lineHeight:1.3 }}>{c.name}</h3>
                  <p style={{ fontSize:11, color:"#77736B", fontFamily:"'JetBrains Mono',monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {c.website_url}
                  </p>
                  <div style={{ paddingTop:10, borderTop:"1px solid rgba(229,223,211,0.7)", fontSize:11, color:"#7C8460", fontWeight:600 }}>OPEN WORKSPACE →</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FINAL CTA */}
      <div className="ds-world" style={{ padding:"52px 40px", textAlign:"center", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(circle at 50% 50%, rgba(244,197,66,0.12) 0%, transparent 70%)", pointerEvents:"none" }}/>
        <div style={{ position:"relative", zIndex:1 }}>
          <div className="ds-label" style={{ marginBottom:12 }}>Ready to Start?</div>
          <h2 className="font-editorial" style={{ fontSize:"clamp(28px,4vw,48px)", fontWeight:700, color:"#191817", marginBottom:16 }}>
            Ready to investigate <em style={{ color:"#7C8460" }}>a company?</em>
          </h2>
          <p style={{ fontSize:14, color:"#5C5850", marginBottom:32, maxWidth:420, marginLeft:"auto", marginRight:"auto" }}>
            Enter any company name and website. DeepScout handles the rest.
          </p>
          <button onClick={() => navigate("/research")} className="btn-gold" style={{ padding:"16px 40px", fontSize:15 }}>
            START NEW RESEARCH <ArrowUpRight size={18}/>
          </button>
        </div>
      </div>

      <style>{`
        @media(min-width:900px) { #hero-grid { grid-template-columns: 7fr 5fr !important; } }
        @media(max-width:900px) { #feat-strip, #feat-cards { grid-template-columns: 1fr 1fr !important; } }
        @media(max-width:600px) {
          #feat-strip { grid-template-columns: 1fr 1fr !important; }
          #feat-cards { grid-template-columns: 1fr !important; }
          #pipeline-stages { flex-direction: column !important; }
          .ds-pipe-line { width: 2px !important; height: 16px !important; flex: none !important; min-width: 0 !important;
            background: linear-gradient(180deg, rgba(229,223,211,0.4), rgba(244,197,66,0.5), rgba(229,223,211,0.4)) !important; }
        }
      `}</style>
    </div>
  );
}

/* ── RESEARCH PAGE ── */
const JOB_STEPS = [
  { key:"discover", label:"DISCOVER", icon: Globe },
  { key:"clean",    label:"CLEAN",    icon: Filter },
  { key:"chunk",    label:"CHUNK",    icon: Layers },
  { key:"embed",    label:"EMBED",    icon: Cpu },
  { key:"retrieve", label:"RETRIEVE", icon: Database },
  { key:"answer",   label:"ANSWER",   icon: Sparkles },
];
type JobStep = "idle"|"discover"|"clean"|"chunk"|"embed"|"retrieve"|"answer"|"done"|"error";

function ResearchPage() {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [triggering, setTriggering] = useState(false);
  const [formError, setFormError] = useState("");
  const [jobId, setJobId] = useState<string|null>(null);
  const [jobData, setJobData] = useState<JobStatus|null>(null);
  const [currentStep, setCurrentStep] = useState<JobStep>("idle");
  const pollRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const cIdRef = useRef<string|null>(null);

  const getStep = (s: string): JobStep => {
    if (s==="pending"||s==="crawling") return "discover";
    if (s==="processing") return "chunk";
    if (s==="embedding")  return "embed";
    if (s==="indexing")   return "retrieve";
    if (s==="completed")  return "done";
    if (s==="failed")     return "error";
    return "discover";
  };
  const startPolling = useCallback((jId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jobs/${jId}`);
        if (res.ok) {
          const data: JobStatus = await res.json();
          setJobData(data); setCurrentStep(getStep(data.status));
          if (data.status==="completed"||data.status==="failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            if (data.status==="completed"&&cIdRef.current) setTimeout(()=>navigate(`/research/${cIdRef.current}`),1200);
          }
        }
      } catch {}
    }, 1800);
  }, [navigate]);
  useEffect(()=>()=>{ if (pollRef.current) clearInterval(pollRef.current); },[]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError("");
    if (!companyName.trim()||!companyUrl.trim()) { setFormError("Please enter both Company Name and Website URL."); return; }
    setTriggering(true);
    try {
      const res = await fetch(`${API_BASE}/api/research`,{ method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({company_name:companyName.trim(),company_url:companyUrl.trim()}) });
      if (res.ok) {
        const data = await res.json();
        cIdRef.current = data.company_id; setJobId(data.job_id); setCurrentStep("discover"); startPolling(data.job_id);
      } else {
        const err = await res.json(); setFormError(err.detail||"Failed to start research."); setTriggering(false);
      }
    } catch { setFormError("Connection error. Is the backend running at port 8000?"); setTriggering(false); }
  };

  const stepIdx = JOB_STEPS.findIndex(s=>s.key===currentStep);

  return (
    <div style={{ padding:"0 16px 60px", maxWidth:960, margin:"0 auto" }}>
      <div className="ds-world" style={{ padding:"48px 40px" }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div className="ds-label" style={{ marginBottom:8 }}>DEEPSCOUT RESEARCH ENGINE</div>
          <h1 className="font-editorial" style={{ fontSize:"clamp(28px,4vw,48px)", fontWeight:800, color:"#191817", letterSpacing:"-0.02em" }}>
            Research a Company
          </h1>
          <p style={{ fontSize:14, color:"#5C5850", marginTop:12, maxWidth:500, margin:"12px auto 0", lineHeight:1.7 }}>
            Give DeepScout a company and its website. We'll investigate, index the evidence, and build a grounded intelligence workspace.
          </p>
        </div>

        {!jobId ? (
          <div style={{ maxWidth:560, margin:"0 auto" }}>
            <form onSubmit={handleSubmit}>
              <div className="ds-card" style={{ padding:36, display:"flex", flexDirection:"column", gap:20 }}>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  <label style={{ fontSize:11, fontWeight:700, color:"#191817", textTransform:"uppercase", letterSpacing:"0.1em", display:"flex", alignItems:"center", gap:6 }}>
                    <Building2 size={14} color="#7C8460"/> Company Name
                  </label>
                  <input type="text" value={companyName} onChange={e=>setCompanyName(e.target.value)}
                    placeholder="e.g. Tata Consultancy Services" disabled={triggering} className="ds-input"/>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  <label style={{ fontSize:11, fontWeight:700, color:"#191817", textTransform:"uppercase", letterSpacing:"0.1em", display:"flex", alignItems:"center", gap:6 }}>
                    <Globe size={14} color="#7C8460"/> Website URL
                  </label>
                  <input type="text" value={companyUrl} onChange={e=>setCompanyUrl(e.target.value)}
                    placeholder="e.g. https://www.tcs.com/" disabled={triggering} className="ds-input font-code" style={{ fontSize:13 }}/>
                </div>
                {formError && (
                  <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 16px", background:"rgba(254,226,226,0.6)", border:"1px solid rgba(153,27,27,0.15)", borderRadius:14, fontSize:12, color:"#991B1B" }}>
                    <XCircle size={15} color="#ef4444" style={{ flexShrink:0 }}/> {formError}
                  </div>
                )}
                <button type="submit" disabled={triggering} className="btn-gold" style={{ justifyContent:"center", padding:"15px", fontSize:14, marginTop:4 }}>
                  {triggering ? <><Loader2 size={16} style={{ animation:"spin 1s linear infinite" }}/> Initializing...</> : <>START RESEARCH <ArrowUpRight size={17}/></>}
                </button>
              </div>
            </form>
            <div style={{ marginTop:22, display:"flex", alignItems:"center", gap:0 }}>
              {JOB_STEPS.map((s,i)=>{
                const Ic=s.icon;
                return (
                  <div key={s.key} style={{ display:"flex", alignItems:"center", flex:1 }}>
                    <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:5, padding:"10px 4px", borderRadius:14, background:"rgba(255,255,255,0.5)", border:"1px solid rgba(229,223,211,0.4)" }}>
                      <Ic size={14} color="#9E988D"/>
                      <span style={{ fontSize:8, fontWeight:700, color:"#9E988D", textTransform:"uppercase", letterSpacing:"0.05em" }}>{s.label}</span>
                    </div>
                    {i<JOB_STEPS.length-1&&<div style={{ height:1, minWidth:8, flex:"0 0 8px", background:"rgba(229,223,211,0.5)" }}/>}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth:640, margin:"0 auto" }}>
            <div className="ds-card" style={{ padding:32, display:"flex", flexDirection:"column", gap:28 }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ width:56, height:56, borderRadius:"50%", background:"rgba(244,197,66,0.15)", border:"2px solid #F4C542", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
                  {currentStep==="done" ? <Check size={24} color="#065F46"/> : currentStep==="error" ? <AlertTriangle size={24} color="#991B1B"/> :
                    <Loader2 size={24} color="#F4C542" style={{ animation:"spin 1s linear infinite" }}/>}
                </div>
                <div style={{ fontSize:15, fontWeight:700, color:"#191817" }}>
                  {currentStep==="done" ? "Research Complete! Redirecting..." : currentStep==="error" ? "Research Failed" : `Investigating ${companyName}...`}
                </div>
                {jobData && (
                  <div style={{ fontSize:12, color:"#77736B", marginTop:4 }}>
                    {jobData.pages_discovered ? `${jobData.pages_discovered} pages discovered` : ""}
                    {jobData.pages_processed  ? ` · ${jobData.pages_processed} processed` : ""}
                  </div>
                )}
              </div>
              <div style={{ display:"flex", gap:0, alignItems:"center" }}>
                {JOB_STEPS.map((s,i)=>{
                  const Ic=s.icon; const done=stepIdx>i||currentStep==="done"; const active=stepIdx===i&&currentStep!=="done"&&currentStep!=="error";
                  return (
                    <div key={s.key} style={{ display:"flex", alignItems:"center", flex:1 }}>
                      <div className={`ds-step${active?" active":done?" done":""}`} style={{ flex:1, gap:4 }}>
                        {done?<Check size={13} color="#065F46"/>:<Ic size={13} color={active?"#191817":"#9E988D"}/>}
                        <span style={{ fontSize:8, fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase", color:done?"#065F46":active?"#191817":"#9E988D" }}>{s.label}</span>
                      </div>
                      {i<JOB_STEPS.length-1&&<div className="ds-pipe-line" style={{ minWidth:8 }}/>}
                    </div>
                  );
                })}
              </div>
              {jobData?.logs && (
                <div className="font-code" style={{ background:"rgba(25,24,23,0.05)", borderRadius:14, padding:"14px 18px", fontSize:11, color:"#5C5850", lineHeight:1.7, maxHeight:120, overflowY:"auto", border:"1px solid rgba(229,223,211,0.5)" }}>
                  {jobData.logs.split("\n").slice(-6).join("\n")}
                </div>
              )}
              {currentStep==="error" && (
                <button onClick={()=>{setJobId(null);setTriggering(false);setCurrentStep("idle");}} className="btn-ghost" style={{ justifyContent:"center" }}>
                  <RefreshCw size={14}/> Try Again
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ── COMPANY WORKSPACE PAGE ── */
function CompanyWorkspacePage() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<CompanyItem|null>(null);
  const [loading, setLoading] = useState(true);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);
  const [activeCitation, setActiveCitation] = useState<Citation|null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number|null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/companies`);
        if (res.ok) {
          const list: CompanyItem[] = await res.json();
          const found = list.find(c => c.id === companyId);
          if (found) { setCompany(found); loadHistory(found.id); }
        }
      } catch {}
      finally { setLoading(false); }
    })();
  }, [companyId]);

  const loadHistory = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/companies/${id}/history`);
      if (res.ok) {
        const data = await res.json();
        const msgs: ChatMessage[] = [];
        [...data].reverse().forEach((item: { question: string; answer: string; citations?: Citation[] }) => {
          msgs.push({ role:"user", text:item.question });
          msgs.push({ role:"assistant", text:item.answer, citations:item.citations||[] });
        });
        if (msgs.length === 0) msgs.push({ role:"assistant", text:"DeepScout workspace ready! Ask any research question — every answer is grounded strictly on indexed evidence." });
        setChatHistory(msgs);
      }
    } catch {}
  };

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [chatHistory]);

  const sendQuestion = async (q: string) => {
    if (!q.trim()||!companyId||queryLoading) return;
    setChatInput(""); setQueryLoading(true);
    setChatHistory(prev => [...prev, { role:"user", text:q.trim() }]);
    try {
      const res = await fetch(`${API_BASE}/api/query`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ company_id:companyId, question:q.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setChatHistory(prev => [...prev, { role:"assistant", text:data.answer, citations:data.citations||[] }]);
      } else {
        setChatHistory(prev => [...prev, { role:"assistant", text:"Query failed. Check backend logs." }]);
      }
    } catch {
      setChatHistory(prev => [...prev, { role:"assistant", text:"Connection error. Verify backend server." }]);
    } finally { setQueryLoading(false); }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text); setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  if (loading) return (
    <div style={{ padding:"60px 16px", maxWidth:960, margin:"0 auto" }}>
      <div className="ds-card" style={{ padding:36, display:"flex", alignItems:"center", gap:12, justifyContent:"center" }}>
        <Loader2 size={20} color="#F4C542" style={{ animation:"spin 1s linear infinite" }}/>
        <span style={{ fontSize:14, color:"#77736B" }}>Opening DeepScout Workspace...</span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!company) return (
    <div style={{ padding:"60px 16px", maxWidth:960, margin:"0 auto", textAlign:"center" }}>
      <h2 className="font-editorial" style={{ fontSize:28, fontWeight:700, color:"#191817", marginBottom:16 }}>Company Not Found</h2>
      <button onClick={() => navigate("/companies")} className="btn-gold">Back to Directory</button>
    </div>
  );

  const PROMPTS = [
    `What products and services does ${company.name} offer?`,
    `What is ${company.name}'s technology stack?`,
    `What career opportunities exist at ${company.name}?`,
  ];

  return (
    <div style={{ padding:"0 16px 60px", maxWidth:1040, margin:"0 auto" }}>
      <div className="ds-world" style={{ padding:"32px 36px", display:"flex", flexDirection:"column", gap:24, minHeight:"75vh" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingBottom:20, borderBottom:"1px solid rgba(229,223,211,0.7)", flexWrap:"wrap", gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ width:52, height:52, borderRadius:18, background:"#F4C542", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 12px rgba(244,197,66,0.35)" }}>
              <Building2 size={26} color="#191817"/>
            </div>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                <h1 className="font-editorial" style={{ fontSize:24, fontWeight:800, color:"#191817" }}>{company.name}</h1>
                <span className="ds-badge ds-badge-green">● READY</span>
              </div>
              <a href={company.website_url} target="_blank" rel="noreferrer"
                style={{ fontSize:11, color:"#7C8460", fontFamily:"'JetBrains Mono',monospace", display:"flex", alignItems:"center", gap:4, textDecoration:"none" }}>
                {company.website_url} <ExternalLink size={11}/>
              </a>
            </div>
          </div>
          <button onClick={() => navigate("/sources")} className="btn-ghost" style={{ fontSize:12, padding:"9px 18px" }}>
            <Eye size={14}/> View Sources
          </button>
        </div>

        {/* Scope card */}
        <div className="ds-card" style={{ padding:"18px 22px", display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:38, height:38, borderRadius:12, background:"rgba(124,132,96,0.12)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <BookOpen size={17} color="#7C8460"/>
          </div>
          <div>
            <div className="ds-label" style={{ marginBottom:3 }}>EDITORIAL INTELLIGENCE REPORT</div>
            <p style={{ fontSize:12, color:"#5C5850", lineHeight:1.6 }}>
              {company.name} has been vector-indexed using local BGE embeddings (768d) on Neon PostgreSQL pgvector. All answers are grounded strictly against retrieved chunks.
            </p>
          </div>
        </div>

        {/* Chat */}
        <div style={{ display:"flex", flexDirection:"column", gap:20, flex:1 }}>
          {chatHistory.map((msg, idx) => {
            const isU = msg.role === "user";
            return (
              <div key={idx} style={{ display:"flex", gap:10, flexDirection:isU?"row-reverse":"row", maxWidth:"85%", marginLeft:isU?"auto":"0", marginRight:isU?"0":"auto" }}>
                <div style={{ width:34, height:34, borderRadius:"50%", background:isU?"#191817":"#F4C542", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:isU?"white":"#191817", flexShrink:0, alignSelf:"flex-end" }}>
                  {isU ? "U" : "DS"}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:6, position:"relative" }}>
                  <div className={isU ? "ds-msg-user" : "ds-msg-ai"}>
                    <div style={{ whiteSpace:"pre-line" }}>{msg.text}</div>
                    {!isU && msg.citations && msg.citations.length > 0 && (
                      <div style={{ marginTop:14, paddingTop:12, borderTop:"1px solid rgba(229,223,211,0.7)", display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
                        <span style={{ fontSize:10, color:"#77736B", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginRight:4 }}>EVIDENCE:</span>
                        {msg.citations.map(cit => (
                          <button key={cit.index} onClick={() => setActiveCitation(cit)} className="ds-citation">
                            <span className="font-code" style={{ fontSize:10, color:"#7C8460", fontWeight:700 }}>[{cit.index}]</span>
                            <span style={{ maxWidth:130, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{cit.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {!isU && (
                    <button onClick={() => handleCopy(msg.text, idx)}
                      style={{ position:"absolute", top:8, right:8, padding:5, borderRadius:9999, border:"1px solid rgba(229,223,211,0.8)", background:"rgba(255,255,255,0.9)", cursor:"pointer", display:"flex", opacity:0.6, transition:"opacity 0.2s" }}
                      onMouseEnter={e=>(e.currentTarget.style.opacity="1")} onMouseLeave={e=>(e.currentTarget.style.opacity="0.6")}>
                      {copiedIdx===idx ? <Check size={13} color="#065F46"/> : <Copy size={13} color="#77736B"/>}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {queryLoading && (
            <div style={{ display:"flex", gap:10, maxWidth:"85%" }}>
              <div style={{ width:34, height:34, borderRadius:"50%", background:"#F4C542", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, alignSelf:"flex-end" }}>
                <Loader2 size={15} color="#191817" style={{ animation:"spin 1s linear infinite" }}/>
              </div>
              <div className="ds-msg-ai" style={{ display:"flex", alignItems:"center", gap:10 }}>
                <Loader2 size={14} color="#7C8460" style={{ animation:"spin 1s linear infinite", flexShrink:0 }}/>
                <span style={{ fontSize:12, color:"#5C5850" }}>Executing hybrid retrieval + Gemini grounded synthesis...</span>
              </div>
            </div>
          )}
          <div ref={chatBottomRef}/>
        </div>

        {/* Input */}
        <div style={{ paddingTop:16, borderTop:"1px solid rgba(229,223,211,0.7)", display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:2 }}>
            <span style={{ fontSize:10, fontWeight:700, color:"#77736B", textTransform:"uppercase", letterSpacing:"0.08em", flexShrink:0, alignSelf:"center" }}>PROMPTS:</span>
            {PROMPTS.map((p,i) => (
              <button key={i} onClick={() => sendQuestion(p)} disabled={queryLoading}
                style={{ fontSize:11, padding:"7px 14px", borderRadius:9999, border:"1px solid rgba(229,223,211,0.8)", background:"rgba(255,255,255,0.75)", color:"#191817", fontWeight:600, cursor:"pointer", flexShrink:0, transition:"all 0.2s", whiteSpace:"nowrap" }}
                onMouseEnter={e=>{e.currentTarget.style.background="#FEF3C7";e.currentTarget.style.borderColor="#F4C542";}}
                onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.75)";e.currentTarget.style.borderColor="rgba(229,223,211,0.8)";}}>
                {p}
              </button>
            ))}
          </div>
          <form onSubmit={e=>{e.preventDefault();sendQuestion(chatInput);}} style={{ display:"flex", gap:10, alignItems:"center" }}>
            <input type="text" value={chatInput} onChange={e=>setChatInput(e.target.value)}
              placeholder={`Ask any research question about ${company.name}...`} disabled={queryLoading}
              className="ds-input" style={{ paddingRight:14 }}/>
            <button type="submit" disabled={!chatInput.trim()||queryLoading} className="btn-icon">
              <Send size={17}/>
            </button>
          </form>
        </div>
      </div>

      {/* Evidence Drawer */}
      {activeCitation && (
        <div className="ds-drawer-bg" onClick={e=>{if(e.target===e.currentTarget) setActiveCitation(null);}}>
          <div className="ds-drawer">
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingBottom:16, borderBottom:"1px solid rgba(229,223,211,0.7)" }}>
              <div className="font-editorial" style={{ fontSize:18, fontWeight:700, color:"#191817", display:"flex", alignItems:"center", gap:8 }}>
                <FileText size={18} color="#7C8460"/> Evidence Dossier
              </div>
              <button onClick={() => setActiveCitation(null)} style={{ padding:6, border:"none", background:"rgba(229,223,211,0.4)", borderRadius:9999, cursor:"pointer", display:"flex" }}>
                <X size={16} color="#77736B"/>
              </button>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <span className="ds-badge ds-badge-gold font-code">Citation [{activeCitation.index}]</span>
              <span className={`ds-badge ds-badge-${activeCitation.source_type}`}>{activeCitation.source_type}</span>
            </div>
            <div>
              <div className="ds-label" style={{ marginBottom:6 }}>Document Title</div>
              <h4 className="font-editorial" style={{ fontSize:16, fontWeight:700, color:"#191817" }}>{activeCitation.title}</h4>
            </div>
            <div>
              <div className="ds-label" style={{ marginBottom:6 }}>Section Header</div>
              <div className="font-code" style={{ fontSize:12, color:"#191817", background:"rgba(255,255,255,0.7)", border:"1px solid rgba(229,223,211,0.7)", padding:"12px 16px", borderRadius:14 }}>
                {activeCitation.section_header || "# Overview"}
              </div>
            </div>
            {activeCitation.snippet && (
              <div>
                <div className="ds-label" style={{ marginBottom:6 }}>Extracted Evidence</div>
                <p style={{ fontSize:12, color:"#5C5850", background:"rgba(255,255,255,0.7)", border:"1px solid rgba(229,223,211,0.7)", padding:"14px 18px", borderRadius:14, lineHeight:1.75, fontStyle:"italic" }}>
                  "{activeCitation.snippet}"
                </p>
              </div>
            )}
            {activeCitation.relevance_score !== undefined && (
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div className="ds-label">RELEVANCE</div>
                <div style={{ flex:1, height:6, background:"rgba(229,223,211,0.5)", borderRadius:9999, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${activeCitation.relevance_score*100}%`, background:"linear-gradient(90deg,#F4C542,#E9B82E)", borderRadius:9999 }}/>
                </div>
                <span className="font-code" style={{ fontSize:12, fontWeight:700, color:"#191817" }}>
                  {activeCitation.relevance_score.toFixed(2)}
                </span>
              </div>
            )}
            <div>
              <div className="ds-label" style={{ marginBottom:6 }}>Source Link</div>
              <a href={activeCitation.url} target="_blank" rel="noreferrer"
                style={{ fontSize:12, color:"#7C8460", fontFamily:"'JetBrains Mono',monospace", display:"flex", alignItems:"center", gap:5, textDecoration:"none", wordBreak:"break-all" }}>
                {activeCitation.url} <ExternalLink size={13} style={{ flexShrink:0 }}/>
              </a>
            </div>
            <div style={{ marginTop:"auto", background:"rgba(209,250,229,0.6)", border:"1px solid rgba(6,95,70,0.15)", borderRadius:16, padding:"14px 18px", display:"flex", gap:10 }}>
              <ShieldCheck size={18} color="#065F46" style={{ flexShrink:0, marginTop:1 }}/>
              <div style={{ fontSize:12, color:"#065F46" }}>
                <strong style={{ display:"block", marginBottom:2 }}>Grounded Vector Match</strong>
                Verified directly from PostgreSQL pgvector candidate chunks.
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ── COMPANIES DIRECTORY PAGE ── */
function DirectoryPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/companies`);
        if (res.ok) setCompanies(await res.json());
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const handleDelete = async (e: React.MouseEvent, companyId: string, companyName: string) => {
    e.stopPropagation();
    if (!confirm(`Remove "${companyName}" and all its indexed data? This cannot be undone.`)) return;
    setDeletingId(companyId);
    try {
      const res = await fetch(`${API_BASE}/api/companies/${companyId}`, { method: "DELETE" });
      if (res.ok) {
        setCompanies(prev => prev.filter(c => c.id !== companyId));
      } else {
        alert("Failed to delete company. Please try again.");
      }
    } catch {
      alert("Connection error while deleting.");
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.website_url.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding:"0 16px 60px", maxWidth:1300, margin:"0 auto" }}>
      <div className="ds-world" style={{ padding:"40px" }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:28, gap:20, flexWrap:"wrap" }}>
          <div>
            <div className="ds-label" style={{ marginBottom:8 }}>Research Directory</div>
            <h1 className="font-editorial" style={{ fontSize:"clamp(24px,3.5vw,40px)", fontWeight:800, color:"#191817" }}>
              Your Researched Companies
            </h1>
            <p style={{ fontSize:13, color:"#77736B", marginTop:6 }}>Every company investigated with DeepScout.</p>
          </div>
          <button onClick={() => navigate("/research")} className="btn-gold">
            + New Research <ArrowUpRight size={15}/>
          </button>
        </div>

        <div style={{ maxWidth:400, marginBottom:24, position:"relative" }}>
          <Search size={15} color="#77736B" style={{ position:"absolute", left:16, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}/>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filter by company or domain..." className="ds-input" style={{ paddingLeft:42, paddingTop:11, paddingBottom:11 }}/>
        </div>

        {loading ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:20 }}>
            {[1,2,3].map(i => <div key={i} className="ds-skeleton" style={{ height:180 }}/>)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px", background:"rgba(255,255,255,0.45)", borderRadius:24, border:"1px solid rgba(229,223,211,0.5)" }}>
            <Star size={32} color="#E5DFD3" style={{ margin:"0 auto 12px" }}/>
            <div style={{ fontSize:15, fontWeight:600, color:"#77736B" }}>No companies yet</div>
            <p style={{ fontSize:13, color:"#9E988D", marginTop:6, marginBottom:20 }}>Start a research target to build your first workspace.</p>
            <button onClick={() => navigate("/research")} className="btn-gold">Start Research <ArrowUpRight size={14}/></button>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:20 }}>
            {filtered.map(c => (
              <div key={c.id} className="ds-card ds-card-hover" style={{ padding:"24px", cursor:"pointer", display:"flex", flexDirection:"column", gap:14, position:"relative" }}
                onClick={() => navigate(`/research/${c.id}`)}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span className="ds-badge ds-badge-green">● READY</span>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <Clock size={13} color="#9E988D"/>
                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDelete(e, c.id, c.name)}
                      disabled={deletingId === c.id}
                      title="Remove company"
                      style={{
                        padding:"4px 6px", border:"1px solid rgba(229,223,211,0.7)", borderRadius:8,
                        background:"rgba(255,255,255,0.8)", cursor:"pointer", display:"flex", alignItems:"center",
                        color: "#991B1B", opacity: deletingId === c.id ? 0.5 : 1, transition:"all 0.15s",
                        lineHeight:1
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(254,226,226,0.9)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(153,27,27,0.3)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.8)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(229,223,211,0.7)"; }}
                    >
                      {deletingId === c.id
                        ? <Loader2 size={12} style={{ animation:"spin 1s linear infinite" }} color="#991B1B"/>
                        : <XCircle size={12} color="#991B1B"/>
                      }
                    </button>
                  </div>
                </div>
                <div>
                  <h3 className="font-editorial" style={{ fontSize:17, fontWeight:700, color:"#191817", lineHeight:1.3, marginBottom:4 }}>{c.name}</h3>
                  <p className="font-code" style={{ fontSize:11, color:"#77736B", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.website_url}</p>
                </div>
                <div style={{ marginTop:"auto", paddingTop:14, borderTop:"1px solid rgba(229,223,211,0.7)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ fontSize:11, fontWeight:700, color:"#191817" }}>OPEN WORKSPACE</span>
                  <ArrowUpRight size={16} color="#7C8460"/>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


/* ── SOURCES PAGE ── */
function SourcesPage() {
  const [filter, setFilter] = useState("all");
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  useEffect(() => {
    fetch(`${API_BASE}/api/companies`).then(r=>r.ok?r.json():[]).then(d=>{if(Array.isArray(d))setCompanies(d);}).catch(()=>{});
  }, []);

  const SOURCES = [
    { title:"Core Services & Solutions Portfolio",  type:"services",  score:0.89, chunk:"chk_9a12b", company:"TCS" },
    { title:"Engineering Careers & Hiring",         type:"careers",   score:0.84, chunk:"chk_4f81c", company:"TCS" },
    { title:"Financial Brief & Investor Overview",  type:"investors", score:0.78, chunk:"chk_3d11e", company:"TCS" },
    { title:"Press Releases & Enterprise News",     type:"news",      score:0.74, chunk:"chk_7b29a", company:"TCS" },
    { title:"Company Profile & Executive Overview", type:"about",     score:0.71, chunk:"chk_1e40c", company:"TCS" },
    { title:"Global Delivery Centers Network",      type:"services",  score:0.68, chunk:"chk_2e99d", company:"TCS" },
  ];
  const filtered = SOURCES.filter(s => filter==="all" || s.type===filter);

  return (
    <div style={{ padding:"0 16px 60px", maxWidth:1300, margin:"0 auto" }}>
      <div className="ds-world" style={{ padding:"40px" }}>
        <div style={{ marginBottom:28 }}>
          <div className="ds-label" style={{ marginBottom:8 }}>Evidence Archive</div>
          <h1 className="font-editorial" style={{ fontSize:"clamp(24px,3.5vw,40px)", fontWeight:800, color:"#191817" }}>The Evidence</h1>
          <p style={{ fontSize:13, color:"#77736B", marginTop:6 }}>Every grounded answer starts with a verified source page.</p>
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:24, flexWrap:"wrap" }}>
          {["all","services","careers","investors","news","about"].map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              style={{ fontSize:12, padding:"7px 18px", borderRadius:9999, border:"1px solid transparent", fontWeight:600, cursor:"pointer", transition:"all 0.2s",
                background:filter===cat?"#F4C542":"rgba(255,255,255,0.7)",
                borderColor:filter===cat?"#E9B82E":"rgba(229,223,211,0.7)",
                color:filter===cat?"#191817":"#77736B",
                boxShadow:filter===cat?"0 2px 8px rgba(244,197,66,0.30)":"none",
                textTransform:"capitalize" }}>
              {cat}
            </button>
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:18 }}>
          {filtered.map((item, i) => (
            <div key={i} className="ds-card" style={{ padding:"24px", display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span className={`ds-badge ds-badge-${item.type}`}>{item.type}</span>
                <span className="font-code" style={{ fontSize:11, color:"#7C8460", fontWeight:600 }}>{(item.score*100).toFixed(0)}% match</span>
              </div>
              <h4 className="font-editorial" style={{ fontSize:16, fontWeight:700, color:"#191817", lineHeight:1.3 }}>{item.title}</h4>
              <p className="font-code" style={{ fontSize:10, color:"#77736B" }}>Company: {item.company}</p>
              <div style={{ paddingTop:12, borderTop:"1px solid rgba(229,223,211,0.7)", display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:11, color:"#7C8460", fontWeight:600 }}>
                <span className="font-code">Chunk: {item.chunk}</span>
                <span style={{ display:"flex", alignItems:"center", gap:4, cursor:"pointer" }}>Inspect <ArrowUpRight size={13}/></span>
              </div>
            </div>
          ))}
        </div>
        {companies.length > 0 && (
          <div style={{ marginTop:32, paddingTop:28, borderTop:"1px solid rgba(229,223,211,0.7)" }}>
            <div className="ds-label" style={{ marginBottom:12 }}>Researched Companies</div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              {companies.map(c => (
                <span key={c.id} className="ds-badge ds-badge-olive" style={{ padding:"6px 14px", fontSize:12 }}>{c.name}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── HISTORY PAGE ── */
function HistoryPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<{ company: CompanyItem; items: { question: string; answer: string; citations: Citation[]; created_at: string }[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/companies`);
        if (!res.ok) return;
        const companies: CompanyItem[] = await res.json();
        const all = await Promise.all(companies.map(async c => {
          try {
            const r = await fetch(`${API_BASE}/api/companies/${c.id}/history`);
            const items = r.ok ? await r.json() : [];
            return { company:c, items };
          } catch { return { company:c, items:[] }; }
        }));
        setHistory(all.filter(h => h.items.length > 0));
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <div style={{ padding:"0 16px 60px", maxWidth:920, margin:"0 auto" }}>
      <div className="ds-world" style={{ padding:"40px" }}>
        <div style={{ marginBottom:28 }}>
          <div className="ds-label" style={{ marginBottom:8 }}>Research Audit</div>
          <h1 className="font-editorial" style={{ fontSize:"clamp(24px,3.5vw,40px)", fontWeight:800, color:"#191817" }}>Your Research Journey</h1>
          <p style={{ fontSize:13, color:"#77736B", marginTop:6 }}>Audit log of questions asked and grounded evidence retrieved.</p>
        </div>

        {loading ? (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {[1,2,3].map(i => <div key={i} className="ds-skeleton" style={{ height:80 }}/>)}
          </div>
        ) : history.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px", background:"rgba(255,255,255,0.45)", borderRadius:24, border:"1px solid rgba(229,223,211,0.5)" }}>
            <Clock size={32} color="#E5DFD3" style={{ margin:"0 auto 12px" }}/>
            <div style={{ fontSize:15, fontWeight:600, color:"#77736B" }}>No research history yet</div>
            <p style={{ fontSize:13, color:"#9E988D", marginTop:6, marginBottom:20 }}>Start a research session to build your history.</p>
            <button onClick={() => navigate("/research")} className="btn-gold">Start Research <ArrowUpRight size={14}/></button>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:28 }}>
            {history.map(h => (
              <div key={h.company.id}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                  <span style={{ fontSize:10, fontWeight:800, color:"#F4C542", textTransform:"uppercase", letterSpacing:"0.1em" }}>● {h.company.name.toUpperCase()}</span>
                  <div className="ds-divider" style={{ flex:1 }}/>
                  <button onClick={() => navigate(`/research/${h.company.id}`)}
                    style={{ fontSize:11, fontWeight:600, color:"#7C8460", border:"none", background:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
                    Open <ArrowUpRight size={12}/>
                  </button>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {[...h.items].reverse().slice(0, 6).map((item, idx) => (
                    <div key={idx} className="ds-card" style={{ padding:"18px 22px", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, cursor:"pointer" }}
                      onClick={() => navigate(`/research/${h.company.id}`)}>
                      <div style={{ flex:1 }}>
                        <h4 className="font-editorial" style={{ fontSize:14, fontWeight:700, color:"#191817", marginBottom:4 }}>{item.question}</h4>
                        <p style={{ fontSize:12, color:"#77736B", lineHeight:1.6, overflow:"hidden", textOverflow:"ellipsis", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" as const }}>
                          {item.answer.slice(0, 180)}{item.answer.length > 180 ? "..." : ""}
                        </p>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
                        <span className="ds-badge ds-badge-green">Verified</span>
                        {item.citations?.length > 0 && (
                          <span style={{ fontSize:10, color:"#77736B" }}>{item.citations.length} citations</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── ROOT APP ── */
export default function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight:"100vh", fontFamily:"'Manrope',system-ui,sans-serif", color:"#191817" }}>
        <GlobalNavbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/research" element={<ResearchPage />} />
          <Route path="/research/:companyId" element={<CompanyWorkspacePage />} />
          <Route path="/companies" element={<DirectoryPage />} />
          <Route path="/sources" element={<SourcesPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
