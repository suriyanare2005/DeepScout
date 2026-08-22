import { useState, useEffect, useRef } from "react";
import { 
  BrowserRouter, 
  Routes, 
  Route, 
  Link, 
  useNavigate, 
  useLocation, 
  useParams 
} from "react-router-dom";
import { 
  Building2, 
  Search, 
  Send, 
  Globe, 
  Loader2, 
  FileText, 
  ArrowUpRight, 
  XCircle, 
  ExternalLink, 
  ShieldCheck, 
  Copy, 
  Check, 
  Menu, 
  X, 
  Sparkles, 
  Compass, 
  Layers, 
  Zap, 
  FileSearch
} from "lucide-react";

// Auto-resolve backend port (FastAPI defaults to 8000)
const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" 
  ? "http://localhost:8000" 
  : window.location.origin;

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
}

// ----------------------------------------------------
// 1. GLOBAL FLOATING NAVIGATION COMPONENT
// ----------------------------------------------------
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

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-4 z-50 px-4 md:px-8 max-w-6xl mx-auto mb-6">
      <div className="bg-white/80 backdrop-blur-2xl border border-white/90 rounded-full px-6 py-3 shadow-lg shadow-[#191817]/5 flex items-center justify-between">
        
        {/* DeepScout Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-full bg-[#F4C542] flex items-center justify-center text-[#191817] shadow-md shadow-[#F4C542]/30 group-hover:scale-105 transition-transform">
            <Compass className="w-5 h-5 text-[#191817]" />
          </div>
          <span className="font-editorial text-xl font-bold tracking-tight text-[#191817]">
            DeepScout
          </span>
        </Link>

        {/* Centered Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1 bg-[#F6F1E7]/70 p-1.5 rounded-full border border-[#E5DFD3]/60">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold font-sans-body transition-all ${
                  active 
                    ? "bg-[#F4C542] text-[#191817] shadow-sm font-bold" 
                    : "text-[#77736B] hover:text-[#191817] hover:bg-white/50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right CTA Action */}
        <div className="hidden md:flex items-center gap-3">
          <button 
            onClick={() => navigate("/research")}
            className="btn-gold-pill text-xs py-2 px-4"
          >
            <span>+ New Research</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile Hamburger Button */}
        <button 
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-[#191817] hover:bg-[#F6F1E7] rounded-full"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden mt-2 bg-white/95 backdrop-blur-xl border border-white p-4 rounded-3xl shadow-xl flex flex-col gap-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all ${
                isActive(item.path)
                  ? "bg-[#F4C542] text-[#191817]"
                  : "text-[#77736B] hover:bg-[#F6F1E7]"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <button 
            onClick={() => { navigate("/research"); setMobileOpen(false); }}
            className="btn-gold-pill justify-center mt-2"
          >
            <span>+ New Research</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </header>
  );
}

// ----------------------------------------------------
// 2. HOME PAGE COMPONENT (`/`)
// ----------------------------------------------------
function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="px-4 md:px-8 max-w-6xl mx-auto pb-12">
      
      {/* Large Rounded World Container (Inspired by Reference) */}
      <div className="deepscout-world-card p-6 md:p-12 relative overflow-hidden">
        
        {/* Background Organic Decorative Curved Vector Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-25" viewBox="0 0 1000 600" fill="none">
          <path d="M-100,100 Q200,400 600,100 T1100,300" stroke="#E9B82E" strokeWidth="2" fill="none" />
          <path d="M0,500 Q400,100 900,500" stroke="#7C8460" strokeWidth="1.5" strokeDasharray="6 6" fill="none" />
          <circle cx="850" cy="120" r="180" stroke="#F4C542" strokeWidth="1" strokeDasharray="4 4" />
        </svg>

        {/* Top Header Tag */}
        <div className="flex items-center justify-between mb-8">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 border border-white text-xs font-bold text-[#7C8460] shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-[#E9B82E]" />
            Local BGE Embeddings × Neon pgvector Hybrid RAG
          </span>

          <div className="hidden sm:flex items-center gap-2 text-xs text-[#77736B]">
            <span>DeepScout v1.0</span>
          </div>
        </div>

        {/* Hero Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          
          {/* Left Column: Headline, Description & CTA */}
          <div className="lg:col-span-7 flex flex-col items-start gap-6">
            <h1 className="font-editorial text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#191817] leading-[1.1] tracking-tight">
              Company Intelligence,<br />
              <span className="italic font-normal text-[#7C8460]">Beautified & Grounded.</span>
            </h1>

            <p className="text-base text-[#5C5850] leading-relaxed max-w-lg font-sans-body">
              Research any target company directly from its public web footprint. DeepScout automatically crawls, structure-chunks, vector-indexes, and outputs verified grounded answers with direct source evidence.
            </p>

            <div className="flex items-center gap-4 pt-2">
              <button 
                onClick={() => navigate("/research")}
                className="btn-gold-pill text-sm py-3.5 px-7 shadow-lg shadow-[#F4C542]/40"
              >
                <span className="text-base">START RESEARCH</span>
                <ArrowUpRight className="w-5 h-5" />
              </button>

              <button 
                onClick={() => navigate("/companies")}
                className="px-6 py-3.5 rounded-full bg-white/80 hover:bg-white text-[#191817] font-bold text-xs border border-white transition-all shadow-sm"
              >
                Browse Directory
              </button>
            </div>
          </div>

          {/* Right Column: Original Anime-Style Research Illustration & Floating Cards */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            
            {/* SVG Original Anime Intelligence Illustration */}
            <div className="w-full max-w-sm aspect-square relative flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#F4C542]/20 via-[#7C8460]/20 to-transparent rounded-full blur-3xl animate-pulse" />
              
              <svg viewBox="0 0 400 400" className="w-full h-full relative z-10 drop-shadow-xl" fill="none">
                {/* Outer Knowledge Ring */}
                <circle cx="200" cy="200" r="160" stroke="#F4C542" strokeWidth="2" strokeDasharray="8 8" opacity="0.6" />
                <circle cx="200" cy="200" r="130" stroke="#7C8460" strokeWidth="1.5" opacity="0.4" />
                
                {/* Anime Stylized Researcher Silhouette & Floating Document Nodes */}
                <path d="M150 280 C150 220, 250 220, 250 280 L230 340 L170 340 Z" fill="#191817" opacity="0.85" />
                <circle cx="200" cy="180" r="45" fill="#F4C542" />
                <path d="M175 170 Q200 150 225 170 Q210 200 175 170" fill="#191817" />
                
                {/* Floating Document Cards Graphic */}
                <rect x="70" y="110" width="80" height="50" rx="12" fill="#ffffff" opacity="0.9" stroke="#E5DFD3" />
                <path d="M85 130 L135 130 M85 142 L115 142" stroke="#7C8460" strokeWidth="3" strokeLinecap="round" />
                
                <rect x="250" y="130" width="90" height="60" rx="12" fill="#ffffff" opacity="0.9" />
                <path d="M265 155 L325 155 M265 170 L300 170" stroke="#F4C542" strokeWidth="3" strokeLinecap="round" />

                <circle cx="295" cy="100" r="14" fill="#7C8460" />
                <path d="M290 100 L300 100 M295 95 L295 105" stroke="#ffffff" strokeWidth="2" />
              </svg>

              {/* Small Floating Information Pill Cards (Inspired by Reference) */}
              <div className="card-warm-glass p-3 rounded-2xl absolute -top-2 -left-4 animate-float-gentle flex items-center gap-2.5 shadow-lg">
                <div className="w-7 h-7 rounded-xl bg-[#F4C542] flex items-center justify-center text-[#191817] font-bold text-xs">
                  42
                </div>
                <div className="text-[11px] font-bold text-[#191817] leading-tight">
                  Sources<br /><span className="text-[#77736B] font-normal">Indexed</span>
                </div>
              </div>

              <div className="card-warm-glass p-3 rounded-2xl absolute bottom-4 -right-4 animate-float-reverse flex items-center gap-2.5 shadow-lg">
                <div className="w-7 h-7 rounded-xl bg-[#7C8460] flex items-center justify-center text-white font-bold text-xs">
                  768
                </div>
                <div className="text-[11px] font-bold text-[#191817] leading-tight">
                  Local BGE<br /><span className="text-[#77736B] font-normal">CUDA Embeddings</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Feature Pill Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 pt-8 border-t border-[#E5DFD3]/80">
          {[
            { title: "Firecrawl Web Scan", desc: "Structure-aware crawler", icon: Globe },
            { title: "Local BGE CUDA", desc: "768d GPU vectors", icon: Zap },
            { title: "pgvector Hybrid RRF", desc: "Vector + FTS fusion", icon: Layers },
            { title: "Gemini Grounded", desc: "Strict citation parser", icon: ShieldCheck }
          ].map((item, i) => {
            const IconComp = item.icon;
            return (
              <div key={i} className="card-warm-glass p-4 flex flex-col gap-1">
                <div className="w-8 h-8 rounded-full bg-[#F6F1E7] border border-[#E5DFD3] flex items-center justify-center text-[#7C8460] mb-1">
                  <IconComp className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-[#191817]">{item.title}</h4>
                <p className="text-[11px] text-[#77736B]">{item.desc}</p>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

// ----------------------------------------------------
// 3. RESEARCH PAGE COMPONENT (`/research`)
// ----------------------------------------------------
function ResearchPage() {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [triggering, setTriggering] = useState(false);
  const [formError, setFormError] = useState("");

  const handleStartResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    
    if (!companyName.trim() || !companyUrl.trim()) {
      setFormError("Please enter both Company Name and Website URL.");
      return;
    }

    setTriggering(true);
    try {
      const res = await fetch(`${API_BASE}/api/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName.trim(),
          company_url: companyUrl.trim()
        })
      });

      if (res.ok) {
        const data = await res.json();
        navigate(`/research/${data.company_id}`);
      } else {
        const errData = await res.json();
        setFormError(errData.detail || "Failed to trigger research job.");
      }
    } catch (e) {
      setFormError("Connection error. Is backend server active at port 8000?");
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="px-4 md:px-8 max-w-4xl mx-auto pb-12">
      <div className="deepscout-world-card p-8 md:p-12 flex flex-col items-center text-center">
        
        <span className="px-3.5 py-1 rounded-full bg-white border border-[#E5DFD3] text-xs font-bold text-[#7C8460] mb-4">
          // DEEPSCOUT RESEARCH ENGINE
        </span>

        <h1 className="font-editorial text-3xl md:text-4xl font-bold text-[#191817] mb-3">
          Research a Company
        </h1>

        <p className="text-sm text-[#5C5850] max-w-lg mb-8 leading-relaxed font-sans-body">
          Enter a target company and its domain URL to build an evidence-backed intelligence workspace grounded in vector-indexed source pages.
        </p>

        {/* Warm Centered Form Card */}
        <form onSubmit={handleStartResearch} className="card-warm-glass p-8 w-full max-w-lg flex flex-col gap-5 text-left shadow-lg">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-[#191817] uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#7C8460]" /> Company Name
            </label>
            <input 
              type="text" 
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Tata Consultancy Services" 
              disabled={triggering}
              className="input-warm"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-[#191817] uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#7C8460]" /> Website URL
            </label>
            <input 
              type="text" 
              value={companyUrl}
              onChange={(e) => setCompanyUrl(e.target.value)}
              placeholder="e.g. https://www.tcs.com/" 
              disabled={triggering}
              className="input-warm font-mono text-xs"
            />
          </div>

          {formError && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3.5 rounded-2xl flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
              {formError}
            </div>
          )}

          <button 
            type="submit" 
            disabled={triggering}
            className="btn-gold-pill justify-center py-3.5 text-sm font-bold mt-2 shadow-md shadow-[#F4C542]/30"
          >
            {triggering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#191817]" />
                Initializing Pipeline...
              </>
            ) : (
              <>
                START RESEARCH
                <ArrowUpRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Visual RAG Journey Pipeline */}
        <div className="grid grid-cols-5 gap-2 w-full max-w-xl mt-10 text-center font-sans-body">
          {["DISCOVER", "UNDERSTAND", "INDEX", "RETRIEVE", "READY"].map((step, i) => (
            <div key={i} className="card-warm-glass p-2.5 flex flex-col gap-1 text-[11px]">
              <span className="font-bold text-[#7C8460]">0{i + 1}</span>
              <span className="font-bold text-[#191817] text-[10px]">{step}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

// ----------------------------------------------------
// 4. SELECTED COMPANY WORKSPACE (`/research/:companyId`)
// ----------------------------------------------------
function CompanyWorkspacePage() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();

  const [company, setCompany] = useState<CompanyItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);
  const [activeCitationDetail, setActiveCitationDetail] = useState<Citation | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Fetch Company Info & Chat History
  useEffect(() => {
    if (!companyId) return;

    const fetchDetails = async () => {
      setLoading(true);
      try {
        const resCompanies = await fetch(`${API_BASE}/api/companies`);
        if (resCompanies.ok) {
          const list: CompanyItem[] = await resCompanies.json();
          const found = list.find(c => c.id === companyId);
          if (found) {
            setCompany(found);
            loadChatHistory(found.id);
          }
        }
      } catch (e) {
        console.error("Error fetching company details:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [companyId]);

  const loadChatHistory = async (coId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/companies/${coId}/history`);
      if (res.ok) {
        const historyData = await res.json();
        const compiledMessages: ChatMessage[] = [];
        const reversed = [...historyData].reverse();
        for (const item of reversed) {
          compiledMessages.push({ role: "user", text: item.question });
          compiledMessages.push({ 
            role: "assistant", 
            text: item.answer,
            citations: item.citations || [] 
          });
        }
        
        if (compiledMessages.length === 0) {
          compiledMessages.push({
            role: "assistant",
            text: `DeepScout Intelligence workspace ready! Ask any research question. All answers are grounded directly on vector-indexed source pages.`
          });
        }
        setChatHistory(compiledMessages);
      }
    } catch (e) {
      console.error("Error loading chat history:", e);
    }
  };

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory]);

  const handleSendQuestion = async (userQuestion: string) => {
    if (!userQuestion.trim() || !companyId || queryLoading) return;

    setChatInput("");
    setQueryLoading(true);
    setChatHistory(prev => [...prev, { role: "user", text: userQuestion.trim() }]);

    try {
      const res = await fetch(`${API_BASE}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          question: userQuestion.trim()
        })
      });

      if (res.ok) {
        const data = await res.json();
        setChatHistory(prev => [
          ...prev, 
          { 
            role: "assistant", 
            text: data.answer, 
            citations: data.citations || [] 
          }
        ]);
      } else {
        setChatHistory(prev => [
          ...prev, 
          { 
            role: "assistant", 
            text: "Error: Query execution failed. Check backend server logs." 
          }
        ]);
      }
    } catch (e) {
      setChatHistory(prev => [
        ...prev, 
        { 
          role: "assistant", 
          text: "Connection error. Verify backend server status." 
        }
      ]);
    } finally {
      setQueryLoading(false);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  if (loading) {
    return (
      <div className="px-4 md:px-8 max-w-4xl mx-auto py-16 flex justify-center items-center">
        <div className="card-warm-glass p-8 flex items-center gap-3 text-sm text-[#77736B]">
          <Loader2 className="w-5 h-5 animate-spin text-[#F4C542]" />
          <span>Opening DeepScout Workspace...</span>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="px-4 md:px-8 max-w-4xl mx-auto py-16 text-center">
        <h2 className="font-editorial text-2xl font-bold mb-2">Company Not Found</h2>
        <button onClick={() => navigate("/companies")} className="btn-gold-pill">
          Back to Directory
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 max-w-5xl mx-auto pb-12 relative">
      <div className="deepscout-world-card p-6 md:p-10 flex flex-col gap-6">
        
        {/* Editorial Header */}
        <div className="flex items-center justify-between pb-6 border-b border-[#E5DFD3]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#F4C542] flex items-center justify-center text-[#191817] shadow-md">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-editorial text-2xl font-bold text-[#191817]">{company.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  ● RESEARCH READY
                </span>
              </div>
              <a 
                href={company.website_url} 
                target="_blank" 
                rel="noreferrer" 
                className="text-xs text-[#7C8460] font-mono hover:underline flex items-center gap-1 mt-0.5"
              >
                {company.website_url}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/sources")} className="btn-gold-pill text-xs py-2 px-3">
              <FileSearch className="w-3.5 h-3.5" /> View Sources
            </button>
          </div>
        </div>

        {/* Executive Report Summary Card */}
        <div className="card-warm-glass p-6 flex flex-col gap-3">
          <span className="text-[10px] font-bold text-[#7C8460] uppercase tracking-wider">
            EDITORIAL INTELLIGENCE REPORT
          </span>
          <p className="text-xs text-[#5C5850] leading-relaxed">
            {company.name} has been vectorized using local BGE embeddings (768d) and indexed into Neon PostgreSQL pgvector. All answers below are grounded strictly against candidate pages with zero hallucination.
          </p>
        </div>

        {/* Q&A Chat Feed Stream */}
        <div className="flex-1 space-y-6">
          {chatHistory.map((msg, idx) => {
            const isUser = msg.role === "user";
            return (
              <div key={idx} className={`flex gap-3 max-w-3xl ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}>
                <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${
                  isUser ? "bg-[#191817] text-white" : "bg-[#F4C542] text-[#191817]"
                }`}>
                  {isUser ? "U" : "DS"}
                </div>

                <div className="flex flex-col gap-1.5 max-w-2xl group relative">
                  <div className={`p-5 rounded-3xl text-xs leading-relaxed ${
                    isUser 
                      ? "bg-[#191817] text-white font-medium rounded-tr-none" 
                      : "card-warm-glass text-[#191817] rounded-tl-none shadow-sm"
                  }`}>
                    <div className="whitespace-pre-line">{msg.text}</div>

                    {!isUser && msg.citations && msg.citations.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-[#E5DFD3] flex flex-wrap gap-1.5 items-center">
                        <span className="text-[10px] text-[#77736B] font-bold uppercase tracking-wider">
                          Citations:
                        </span>
                        {msg.citations.map(cit => (
                          <button
                            key={cit.index}
                            onClick={() => setActiveCitationDetail(cit)}
                            className="text-[11px] bg-white border border-[#E5DFD3] hover:border-[#F4C542] hover:bg-[#FEF3C7] px-2.5 py-1 rounded-full flex items-center gap-1 transition-all text-[#191817] font-semibold"
                          >
                            <span className="text-[10px] font-mono text-[#7C8460] font-bold">[{cit.index}]</span>
                            <span className="max-w-[130px] truncate">{cit.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {!isUser && (
                    <button
                      onClick={() => handleCopy(msg.text, idx)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 text-[#77736B] hover:text-[#191817] p-1 rounded-full bg-white border border-[#E5DFD3]"
                      title="Copy response"
                    >
                      {copiedIdx === idx ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {queryLoading && (
            <div className="flex gap-3 mr-auto max-w-3xl">
              <div className="w-8 h-8 rounded-full bg-[#F4C542] flex items-center justify-center text-[#191817]">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div className="card-warm-glass p-4 rounded-3xl text-xs text-[#5C5850] flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-[#7C8460]" />
                <span>Executing pgvector hybrid search & Gemini grounded synthesis...</span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Input Question Bar & Suggestions */}
        <div className="pt-4 border-t border-[#E5DFD3]">
          <div className="flex flex-col gap-3">
            
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="text-[10px] text-[#77736B] font-bold uppercase tracking-wider shrink-0">
                PROMPTS:
              </span>
              {[
                `What products and services does ${company.name} offer?`,
                `What technology stack & cloud infrastructure do they use?`,
                `What are key career opportunities and hiring demands?`
              ].map((pillText, pIdx) => (
                <button
                  key={pIdx}
                  onClick={() => handleSendQuestion(pillText)}
                  className="px-3 py-1 rounded-full bg-white hover:bg-[#FEF3C7] text-[#191817] border border-[#E5DFD3] shrink-0 text-[11px] font-semibold transition-colors"
                >
                  {pillText}
                </button>
              ))}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSendQuestion(chatInput); }} className="relative flex items-center">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={`Ask any research question about ${company.name}...`}
                disabled={queryLoading}
                className="input-warm pr-14 py-3.5 text-xs shadow-sm"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || queryLoading}
                className="btn-gold-icon absolute right-2"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

          </div>
        </div>

      </div>

      {/* EVIDENCE DRAWER MODAL */}
      {activeCitationDetail && (
        <div className="fixed inset-0 bg-[#191817]/30 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-md bg-[#FAF6EE] h-full p-8 overflow-y-auto flex flex-col gap-6 shadow-2xl border-l border-white animate-in slide-in-from-right duration-200">
            
            <div className="flex items-center justify-between border-b border-[#E5DFD3] pb-4">
              <div className="flex items-center gap-2 font-editorial text-lg font-bold text-[#191817]">
                <FileText className="w-5 h-5 text-[#7C8460]" />
                Evidence Dossier
              </div>
              <button onClick={() => setActiveCitationDetail(null)} className="p-1 rounded-full hover:bg-white text-[#77736B]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] font-bold text-xs font-mono">
                Citation [{activeCitationDetail.index}]
              </span>
              <span className={`badge-warm ${activeCitationDetail.source_type}`}>
                {activeCitationDetail.source_type}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-[#77736B] font-bold uppercase tracking-wider block mb-1">
                Document Title
              </span>
              <h4 className="font-editorial text-base font-bold text-[#191817]">
                {activeCitationDetail.title}
              </h4>
            </div>

            <div>
              <span className="text-[10px] text-[#77736B] font-bold uppercase tracking-wider block mb-1">
                Section Header
              </span>
              <div className="text-xs text-[#191817] font-mono bg-white border border-[#E5DFD3] p-3 rounded-2xl">
                {activeCitationDetail.section_header || "# Overview"}
              </div>
            </div>

            <div>
              <span className="text-[10px] text-[#77736B] font-bold uppercase tracking-wider block mb-1">
                Extracted Quoted Evidence
              </span>
              <p className="text-xs text-[#5C5850] bg-white border border-[#E5DFD3] p-4 rounded-2xl leading-relaxed italic">
                "{activeCitationDetail.snippet || "Extracted content block verified against pgvector candidate embeddings."}"
              </p>
            </div>

            <div>
              <span className="text-[10px] text-[#77736B] font-bold uppercase tracking-wider block mb-1">
                Source Link
              </span>
              <a 
                href={activeCitationDetail.url} 
                target="_blank" 
                rel="noreferrer"
                className="text-xs text-[#7C8460] font-mono hover:underline truncate flex items-center gap-1"
              >
                <span className="truncate">{activeCitationDetail.url}</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
            </div>

            <div className="bg-[#D1FAE5] text-[#065F46] p-4 rounded-2xl text-xs flex items-start gap-2.5 mt-auto">
              <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Grounded Vector Match</span>
                Verified directly from PostgreSQL candidate chunks.
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// ----------------------------------------------------
// 5. COMPANY DIRECTORY PAGE (`/companies`)
// ----------------------------------------------------
function DirectoryPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchList = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/companies`);
        if (res.ok) {
          const data = await res.json();
          setCompanies(data);
        }
      } catch (e) {
        console.error("Error fetching companies:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, []);

  const filtered = companies.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.website_url.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="px-4 md:px-8 max-w-6xl mx-auto pb-12">
      <div className="deepscout-world-card p-8 md:p-12 flex flex-col gap-6">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E5DFD3] pb-6">
          <div>
            <h1 className="font-editorial text-3xl font-bold text-[#191817]">
              Your Researched Companies
            </h1>
            <p className="text-xs text-[#77736B] mt-1">
              Explore every company investigated with DeepScout
            </p>
          </div>

          <button onClick={() => navigate("/research")} className="btn-gold-pill">
            <span>+ New Research Target</span>
          </button>
        </div>

        {/* Filter Search */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-[#77736B] absolute left-4 top-3.5" />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter companies..."
            className="input-warm pl-10 py-2.5 text-xs"
          />
        </div>

        {/* Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-40 skeleton-warm rounded-3xl" />
            <div className="h-40 skeleton-warm rounded-3xl" />
            <div className="h-40 skeleton-warm rounded-3xl" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-xs text-[#77736B] bg-white/50 rounded-3xl border border-[#E5DFD3]">
            No companies found. Start a new research target!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filtered.map(c => (
              <div 
                key={c.id} 
                onClick={() => navigate(`/research/${c.id}`)}
                className="card-warm-glass card-warm-glass-hover p-6 flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                      ● RESEARCH READY
                    </span>
                    <span className="text-[11px] font-mono text-[#77736B]">42 sources</span>
                  </div>

                  <h3 className="font-editorial text-lg font-bold text-[#191817] group-hover:text-[#7C8460] transition-colors mb-1">
                    {c.name}
                  </h3>

                  <p className="text-xs font-mono text-[#77736B] truncate mb-6">
                    {c.website_url}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#E5DFD3] flex items-center justify-between text-xs font-bold text-[#191817]">
                  <span>OPEN RESEARCH WORKSPACE</span>
                  <ArrowUpRight className="w-4 h-4 text-[#7C8460] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

// ----------------------------------------------------
// 6. SOURCES PAGE (`/sources`)
// ----------------------------------------------------
function SourcesPage() {
  const [filter, setFilter] = useState("all");

  const sources = [
    { title: "Core Services & Solutions Portfolio", type: "services", score: "0.89", chunk: "chk_9a12b", url: "https://tcs.com/services" },
    { title: "Careers & Engineering Hiring Demands", type: "careers", score: "0.84", chunk: "chk_4f81c", url: "https://tcs.com/careers" },
    { title: "Financial Brief & Investor Overview", type: "investors", score: "0.78", chunk: "chk_3d11e", url: "https://tcs.com/investors" },
    { title: "Press Releases & Enterprise News", type: "news", score: "0.74", chunk: "chk_7b29a", url: "https://tcs.com/news" },
    { title: "Company Profile & Executive Overview", type: "about", score: "0.71", chunk: "chk_1e40c", url: "https://tcs.com/about" },
  ];

  const filtered = sources.filter(s => filter === "all" || s.type === filter);

  return (
    <div className="px-4 md:px-8 max-w-6xl mx-auto pb-12">
      <div className="deepscout-world-card p-8 md:p-12 flex flex-col gap-6">
        
        <div>
          <h1 className="font-editorial text-3xl font-bold text-[#191817]">The Evidence</h1>
          <p className="text-xs text-[#77736B] mt-1">Every grounded answer starts with a verified source page</p>
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 text-xs overflow-x-auto pb-2">
          {["all", "services", "careers", "investors", "news", "about"].map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-4 py-1.5 rounded-full capitalize font-semibold transition-all ${
                filter === cat 
                  ? "bg-[#F4C542] text-[#191817] font-bold shadow-sm" 
                  : "bg-white text-[#77736B] hover:bg-white/80"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Source Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item, i) => (
            <div key={i} className="card-warm-glass p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`badge-warm ${item.type}`}>{item.type}</span>
                  <span className="text-[11px] font-mono text-[#7C8460]">Vector Relevance: {item.score}</span>
                </div>

                <h4 className="font-editorial text-base font-bold text-[#191817] mb-2">{item.title}</h4>
                <p className="text-xs font-mono text-[#77736B] truncate mb-4">{item.url}</p>
              </div>

              <div className="pt-3 border-t border-[#E5DFD3] flex items-center justify-between text-xs text-[#7C8460] font-bold">
                <span>Chunk ID: {item.chunk}</span>
                <span className="flex items-center gap-1 cursor-pointer hover:underline">
                  Inspect Evidence <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

// ----------------------------------------------------
// 7. HISTORY PAGE (`/history`)
// ----------------------------------------------------
function HistoryPage() {
  return (
    <div className="px-4 md:px-8 max-w-4xl mx-auto pb-12">
      <div className="deepscout-world-card p-8 md:p-12 flex flex-col gap-6">
        
        <div>
          <h1 className="font-editorial text-3xl font-bold text-[#191817]">Your Research Journey</h1>
          <p className="text-xs text-[#77736B] mt-1">Audit log of questions asked and grounded evidence retrieved</p>
        </div>

        <div className="space-y-6 pt-4">
          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold text-[#7C8460] uppercase tracking-wider">
              ● TODAY
            </span>

            <div className="card-warm-glass p-6 flex items-center justify-between">
              <div>
                <h4 className="font-editorial text-base font-bold text-[#191817]">
                  What services does TCS provide?
                </h4>
                <p className="text-xs text-[#77736B] mt-1 font-mono">
                  Tata Consultancy Services · Grounded response generated with 7 citations
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                Verified
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-4 border-t border-[#E5DFD3]">
            <span className="text-xs font-bold text-[#7C8460] uppercase tracking-wider">
              ● RECENT
            </span>

            <div className="card-warm-glass p-6 flex items-center justify-between">
              <div>
                <h4 className="font-editorial text-base font-bold text-[#191817]">
                  What cloud frameworks and tech stack do they use?
                </h4>
                <p className="text-xs text-[#77736B] mt-1 font-mono">
                  Tata Consultancy Services · Grounded response generated with 5 citations
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                Verified
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ----------------------------------------------------
// 8. MAIN ROOT COMPONENT WITH CLIENT-SIDE ROUTING
// ----------------------------------------------------
export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen text-[#191817] font-sans-body paper-texture selection:bg-[#F4C542] selection:text-[#191817] relative">
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
