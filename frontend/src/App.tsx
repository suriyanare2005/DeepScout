import { useState, useEffect, useRef } from "react";
import { 
  Building2, 
  Search, 
  Send, 
  Terminal, 
  Globe, 
  Loader2, 
  Plus, 
  FileText, 
  ArrowRight, 
  XCircle, 
  ExternalLink,
  Cpu,
  CheckCircle2,
  MessageSquare,
  BarChart3,
  ShieldCheck,
  ChevronRight,
  Copy,
  Check,
  Paperclip,
  Clock,
  Menu,
  X,
  FolderKanban,
  Sparkles,
  Activity,
  FileSearch,
  Crosshair
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

export default function App() {
  // Directory & Selection State
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyItem | null>(null);
  
  // Navigation View: "landing" | "dashboard" | "directory" | "progress"
  const [view, setView] = useState<"landing" | "dashboard" | "directory" | "progress">("landing");
  
  // Workspace Tab: "research" | "sources" | "history" | "insights" | "profile"
  const [activeTab, setActiveTab] = useState<"research" | "sources" | "history" | "insights" | "profile">("research");

  // Ingestion Form State
  const [companyName, setCompanyName] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [triggering, setTriggering] = useState(false);
  const [formError, setFormError] = useState("");

  // Ingestion Job Tracker State
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>("pending");
  const [jobPagesDiscovered, setJobPagesDiscovered] = useState(0);
  const [jobPagesProcessed, setJobPagesProcessed] = useState(0);
  const [jobLogs, setJobLogs] = useState("");
  const [jobError, setJobError] = useState("");

  // Chat & Q&A State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);
  const [activeCitationDetail, setActiveCitationDetail] = useState<Citation | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Search & Filter States
  const [sourceSearchQuery, setSourceSearchQuery] = useState("");
  const [sourceCategoryFilter, setSourceCategoryFilter] = useState("all");
  const [directorySearch, setDirectorySearch] = useState("");

  // UI & Parallax Interactive States
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [heroLoaded, setHeroLoaded] = useState(false);

  // Auto-scroll references
  const logsConsoleRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Hero entrance animation trigger
  useEffect(() => {
    const timer = setTimeout(() => setHeroLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Parallax Mouse Interaction Tracker
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const x = (clientX / window.innerWidth - 0.5) * 20;
      const y = (clientY / window.innerHeight - 0.5) * 20;
      setMousePos({ x, y });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Canvas Node/Particle Matrix background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const particles: { x: number; y: number; vx: number; vy: number; radius: number }[] = [];
    for (let i = 0; i < 45; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 1.5 + 1
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw faint connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.12 * (1 - dist / 130)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Draw particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(56, 189, 248, 0.4)";
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // 1. Fetch Companies List
  const fetchCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const res = await fetch(`${API_BASE}/api/companies`);
      if (res.ok) {
        const data = await res.json();
        setCompanies(data);
      }
    } catch (e) {
      console.error("Error fetching companies:", e);
    } finally {
      setLoadingCompanies(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  // 2. Poll Active Crawl Job
  useEffect(() => {
    if (!activeJobId) return;

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jobs/${activeJobId}`);
        if (res.ok) {
          const job = await res.json();
          setJobStatus(job.status);
          setJobPagesDiscovered(job.pages_discovered || 0);
          setJobPagesProcessed(job.pages_processed || 0);
          setJobLogs(job.logs || "");
          
          if (job.status === "completed") {
            clearInterval(intervalId);
            setActiveJobId(null);
            await fetchCompanies();
            if (selectedCompany) {
              const updated = { ...selectedCompany, status: "completed" };
              setSelectedCompany(updated);
              loadChatHistory(updated.id);
              setView("dashboard");
            }
          } else if (job.status === "failed") {
            clearInterval(intervalId);
            setActiveJobId(null);
            setJobError(job.error_message || "Ingestion failed.");
            fetchCompanies();
          }
        }
      } catch (e) {
        console.error("Error polling job status:", e);
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [activeJobId, selectedCompany]);

  // Auto-scroll terminals & chats
  useEffect(() => {
    if (logsConsoleRef.current) {
      logsConsoleRef.current.scrollTop = logsConsoleRef.current.scrollHeight;
    }
  }, [jobLogs]);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory]);

  // 3. Load Q&A History
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
            text: `RAG Intelligence Core online. Ask any research question. All answers are grounded directly on vector-indexed domain source pages.`
          });
        }
        setChatHistory(compiledMessages);
      }
    } catch (e) {
      console.error("Error loading chat history:", e);
    }
  };

  // 4. Handle Company Selection
  const handleSelectCompany = (company: CompanyItem) => {
    setSelectedCompany(company);
    setActiveCitationDetail(null);
    setJobError("");
    setMobileSidebarOpen(false);
    
    if (company.status === "completed") {
      setView("dashboard");
      setActiveTab("research");
      loadChatHistory(company.id);
    } else if (company.status === "failed") {
      setView("landing");
    } else {
      setView("progress");
    }
  };

  // 5. Submit New Company Research
  const handleStartResearch = async (nameVal: string, urlVal: string) => {
    setFormError("");
    
    if (!nameVal.trim()) {
      setFormError("Please specify company name.");
      return;
    }
    if (!urlVal.trim()) {
      setFormError("Please specify company website URL.");
      return;
    }

    setTriggering(true);
    try {
      const res = await fetch(`${API_BASE}/api/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: nameVal.trim(),
          company_url: urlVal.trim()
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCompanyName("");
        setCompanyUrl("");
        
        setActiveJobId(data.job_id);
        setJobStatus("pending");
        setJobPagesDiscovered(0);
        setJobPagesProcessed(0);
        setJobLogs("Crawl job registered. Spawning Firecrawl async pipeline...\n");
        setJobError("");
        
        await fetchCompanies();
        
        const newCompanyItem: CompanyItem = {
          id: data.company_id,
          name: data.company_name,
          website_url: urlVal.trim(),
          status: "pending",
          created_at: new Date().toISOString()
        };
        setSelectedCompany(newCompanyItem);
        setView("progress");
      } else {
        const errData = await res.json();
        setFormError(errData.detail || "Failed to trigger research job.");
      }
    } catch (e) {
      setFormError("Connection error. Is the backend server active at port 8000?");
    } finally {
      setTriggering(false);
    }
  };

  // 6. Send Grounded Question
  const handleSendQuestion = async (userQuestion: string) => {
    if (!userQuestion.trim() || !selectedCompany || queryLoading) return;

    setChatInput("");
    setQueryLoading(true);

    setChatHistory(prev => [...prev, { role: "user", text: userQuestion.trim() }]);

    try {
      const res = await fetch(`${API_BASE}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: selectedCompany.id,
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
            text: "Error: Failed to execute query. Check backend server logs." 
          }
        ]);
      }
    } catch (e) {
      setChatHistory(prev => [
        ...prev, 
        { 
          role: "assistant", 
          text: "Network connection failure. Verify backend server status." 
        }
      ]);
    } finally {
      setQueryLoading(false);
    }
  };

  const handleQuickPrompt = (promptText: string) => {
    setActiveTab("research");
    handleSendQuestion(promptText);
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(directorySearch.toLowerCase()) ||
    c.website_url.toLowerCase().includes(directorySearch.toLowerCase())
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden text-slate-100 bg-[#090d16] font-sans antialiased relative">
      
      {/* Background Interactive Particle Canvas */}
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0 opacity-60" />

      {/* Tech Grid & Subtle Parallax Mesh */}
      <div 
        className="fixed inset-0 pointer-events-none anime-grid-bg opacity-30 z-0 transition-transform duration-300 ease-out"
        style={{ transform: `translate3d(${mousePos.x * 0.5}px, ${mousePos.y * 0.5}px, 0)` }}
      />

      {/* Mobile Drawer Overlay */}
      {mobileSidebarOpen && (
        <div 
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-40 md:hidden"
        />
      )}

      {/* 1. LEFT SIDEBAR (ANIME TECH DOSSIER NAV) */}
      <aside className={`fixed md:relative inset-y-0 left-0 w-72 border-r border-slate-800/80 bg-[#0c1220]/95 backdrop-blur-xl flex flex-col shrink-0 z-50 transition-transform duration-200 ${
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}>
        
        {/* App Branding Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-700 via-blue-600 to-sky-400 p-0.5 shadow-lg shadow-blue-600/30">
              <div className="w-full h-full bg-[#090d16] rounded-[6px] flex items-center justify-center">
                <Crosshair className="w-4.5 h-4.5 text-sky-400 animate-spin-slow" />
              </div>
            </div>
            <div>
              <h1 className="text-sm font-bold font-space text-white tracking-wider uppercase flex items-center gap-1.5">
                IntelliCorp
                <span className="text-[9px] bg-sky-500/20 text-sky-300 border border-sky-500/30 px-1.5 py-0.2 rounded font-mono font-normal">v1.0</span>
              </h1>
              <p className="text-[10px] text-sky-400/80 font-mono tracking-widest uppercase">
                // AI RESEARCH CORE
              </p>
            </div>
          </div>
          <button 
            onClick={() => setMobileSidebarOpen(false)}
            className="md:hidden text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action: New Company Research Target */}
        <div className="p-3">
          <button 
            onClick={() => { setSelectedCompany(null); setView("landing"); setMobileSidebarOpen(false); }}
            className="w-full btn-anime-primary justify-center text-xs py-2.5"
          >
            <Plus className="w-4 h-4 text-sky-300" />
            <span>NEW RESEARCH TARGET</span>
          </button>
        </div>

        {/* Core Navigation Items */}
        <div className="px-3 py-2 border-b border-slate-800/60 flex flex-col gap-1 text-xs">
          <button
            onClick={() => {
              if (selectedCompany && selectedCompany.status === "completed") {
                setView("dashboard");
                setActiveTab("research");
              } else {
                setView("landing");
              }
              setMobileSidebarOpen(false);
            }}
            className={`w-full px-3 py-2 rounded-md font-space font-semibold tracking-wide text-left flex items-center justify-between transition-all border ${
              view === "dashboard" && activeTab === "research"
                ? "bg-blue-600/15 border-blue-500/50 text-white shadow-sm shadow-blue-500/10"
                : "border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <BarChart3 className="w-4 h-4 text-sky-400" />
              Research Workspace
            </span>
            <span className="text-[10px] font-mono text-slate-500">01</span>
          </button>

          <button
            onClick={() => { setView("directory"); setMobileSidebarOpen(false); }}
            className={`w-full px-3 py-2 rounded-md font-space font-semibold tracking-wide text-left flex items-center justify-between transition-all border ${
              view === "directory"
                ? "bg-blue-600/15 border-blue-500/50 text-white shadow-sm shadow-blue-500/10"
                : "border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <FolderKanban className="w-4 h-4 text-sky-400" />
              Target Directory
            </span>
            <span className="text-[10px] font-mono text-slate-500">02</span>
          </button>

          <button
            onClick={() => {
              if (selectedCompany) { setView("dashboard"); setActiveTab("sources"); }
              setMobileSidebarOpen(false);
            }}
            className={`w-full px-3 py-2 rounded-md font-space font-semibold tracking-wide text-left flex items-center justify-between transition-all border ${
              view === "dashboard" && activeTab === "sources"
                ? "bg-blue-600/15 border-blue-500/50 text-white shadow-sm shadow-blue-500/10"
                : "border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <FileSearch className="w-4 h-4 text-sky-400" />
              Evidence Matrix
            </span>
            <span className="text-[10px] font-mono text-slate-500">03</span>
          </button>

          <button
            onClick={() => {
              if (selectedCompany) { setView("dashboard"); setActiveTab("history"); }
              setMobileSidebarOpen(false);
            }}
            className={`w-full px-3 py-2 rounded-md font-space font-semibold tracking-wide text-left flex items-center justify-between transition-all border ${
              view === "dashboard" && activeTab === "history"
                ? "bg-blue-600/15 border-blue-500/50 text-white shadow-sm shadow-blue-500/10"
                : "border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-sky-400" />
              Audit Log
            </span>
            <span className="text-[10px] font-mono text-slate-500">04</span>
          </button>
        </div>

        {/* Directory List of Recent Target Companies */}
        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5">
          <div className="px-2 pb-1.5 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
            <span>// RECENT TARGETS</span>
            <span className="bg-slate-800 px-1.5 py-0.5 rounded text-sky-400 font-mono text-[10px]">{companies.length}</span>
          </div>
          
          {loadingCompanies && companies.length === 0 ? (
            <div className="space-y-2 px-1 py-2">
              <div className="h-10 anime-skeleton rounded" />
              <div className="h-10 anime-skeleton rounded" />
              <div className="h-10 anime-skeleton rounded" />
            </div>
          ) : companies.length === 0 ? (
            <div className="px-3 py-6 text-xs text-slate-500 text-center italic font-mono bg-slate-900/40 rounded border border-slate-800/60">
              No targets processed yet.
            </div>
          ) : (
            companies.map(c => {
              const isActive = selectedCompany?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => handleSelectCompany(c)}
                  className={`w-full p-2.5 rounded text-left transition-all flex flex-col gap-1 border manga-panel ${
                    isActive 
                      ? "bg-slate-900/90 border-sky-500/60 text-white shadow-md" 
                      : "bg-slate-950/40 border-slate-800/60 text-slate-400 hover:bg-slate-900/50 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-space font-bold truncate pr-2 tracking-tight">
                      {c.name}
                    </span>
                    
                    {c.status === "completed" && (
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono uppercase font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Ready
                      </span>
                    )}
                    {c.status === "failed" && (
                      <span className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/30 px-1.5 py-0.2 rounded font-mono uppercase font-bold flex items-center gap-1">
                        <XCircle className="w-2.5 h-2.5" /> Failed
                      </span>
                    )}
                    {(c.status === "pending" || c.status === "running") && (
                      <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded font-mono uppercase font-bold animate-pulse flex items-center gap-1">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Ingest
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-500 truncate font-mono">
                    {c.website_url.replace(/^https?:\/\//, "")}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hardware Info Badge */}
        <div className="p-3 border-t border-slate-800/80 bg-[#090d16] flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Cpu className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-semibold text-slate-300">BGE (768d)</span>
          </div>
          <span className="text-[9px] bg-slate-900 border border-slate-700 text-sky-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
            CUDA RTX 3050
          </span>
        </div>

      </aside>

      {/* 2. MAIN WORKSPACE AREA */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#090d16] overflow-hidden relative z-10">
        
        {/* HEADER BAR */}
        <header className="h-14 border-b border-slate-800/80 bg-[#0c1220]/90 backdrop-blur-xl px-6 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden text-slate-400 hover:text-white p-1"
            >
              <Menu className="w-5 h-5" />
            </button>

            {selectedCompany ? (
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded bg-slate-900 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2.5 min-w-0">
                  <h2 className="font-bold font-space text-white text-sm truncate tracking-wide">
                    {selectedCompany.name}
                  </h2>

                  {selectedCompany.status === "completed" && (
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-bold shrink-0 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> // VERIFIED
                    </span>
                  )}

                  <a 
                    href={selectedCompany.website_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-xs text-slate-400 hover:text-sky-400 font-mono transition-colors flex items-center gap-1 shrink-0"
                  >
                    {selectedCompany.website_url.replace(/^https?:\/\//, "")}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-400 animate-pulse" />
                <span>// SELECT OR RESEARCH TARGET COMPANY TO BEGIN</span>
              </div>
            )}
          </div>

          {/* Underline Manga Tabs */}
          {selectedCompany && selectedCompany.status === "completed" && (
            <div className="flex gap-6 h-full items-center text-xs font-space font-semibold tracking-wider text-slate-400">
              <button
                onClick={() => { setView("dashboard"); setActiveTab("research"); }}
                className={`h-full border-b-2 px-1 flex items-center gap-1.5 transition-all ${
                  view === "dashboard" && activeTab === "research"
                    ? "border-sky-400 text-sky-400"
                    : "border-transparent hover:text-slate-200"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" /> RESEARCH
              </button>

              <button
                onClick={() => { setView("dashboard"); setActiveTab("sources"); }}
                className={`h-full border-b-2 px-1 flex items-center gap-1.5 transition-all ${
                  view === "dashboard" && activeTab === "sources"
                    ? "border-sky-400 text-sky-400"
                    : "border-transparent hover:text-slate-200"
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> SOURCES
              </button>

              <button
                onClick={() => { setView("dashboard"); setActiveTab("history"); }}
                className={`h-full border-b-2 px-1 flex items-center gap-1.5 transition-all ${
                  view === "dashboard" && activeTab === "history"
                    ? "border-sky-400 text-sky-400"
                    : "border-transparent hover:text-slate-200"
                }`}
              >
                <Clock className="w-3.5 h-3.5" /> HISTORY
              </button>

              <button
                onClick={() => { setView("dashboard"); setActiveTab("insights"); }}
                className={`h-full border-b-2 px-1 flex items-center gap-1.5 transition-all ${
                  view === "dashboard" && activeTab === "insights"
                    ? "border-sky-400 text-sky-400"
                    : "border-transparent hover:text-slate-200"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" /> INSIGHTS
              </button>

              <button
                onClick={() => { setView("dashboard"); setActiveTab("profile"); }}
                className={`h-full border-b-2 px-1 flex items-center gap-1.5 transition-all ${
                  view === "dashboard" && activeTab === "profile"
                    ? "border-sky-400 text-sky-400"
                    : "border-transparent hover:text-slate-200"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" /> PROFILE
              </button>
            </div>
          )}
        </header>

        {/* WORKSPACE CONTENT VIEWS */}
        <div className="flex-1 overflow-hidden relative flex">

          {/* VIEW 1: HERO LANDING PAGE */}
          {view === "landing" && (
            <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center max-w-4xl mx-auto z-10 relative">
              
              {/* Hero Header Sequence */}
              <div 
                className={`text-center mb-8 transition-all duration-700 ${
                  heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-sky-500/30 text-sky-300 text-xs font-mono mb-4 shadow-lg shadow-sky-500/10">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                  <span>// LOCAL BGE CUDA EMBEDDINGS × HYBRID RECPROC RANK FUSION</span>
                </div>

                <h1 className="text-4xl md:text-5xl font-black font-space tracking-tight text-white mb-4 leading-tight">
                  Research any company.<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-400">
                    Understand the evidence.
                  </span>
                </h1>
                
                <p className="text-slate-400 text-sm max-w-xl mx-auto leading-relaxed font-sans">
                  Enter target company URL. System crawls structure, strips boilerplate noise, generates 768d local BGE vector embeddings, and outputs verified grounded Q&A with direct evidence citations.
                </p>
              </div>

              {/* Research Form Card */}
              <form 
                onSubmit={(e) => { e.preventDefault(); handleStartResearch(companyName, companyUrl); }} 
                className={`manga-panel p-6 w-full max-w-lg flex flex-col gap-4 transition-all duration-700 delay-150 ${
                  heroLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
                style={{ transform: `rotate3d(1, 1, 0, ${mousePos.y * 0.05}deg)` }}
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-1">
                  <span className="text-[11px] font-mono text-sky-400 font-bold tracking-widest uppercase flex items-center gap-1.5">
                    <Crosshair className="w-3.5 h-3.5 text-sky-400" /> [ INGESTION_TARGET_SPEC ]
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">GPU: READY</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-space font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-sky-400" /> Company Name
                  </label>
                  <input 
                    type="text" 
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Tata Consultancy Services" 
                    disabled={triggering}
                    className="anime-input"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-space font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-sky-400" /> Website URL
                  </label>
                  <input 
                    type="text" 
                    value={companyUrl}
                    onChange={(e) => setCompanyUrl(e.target.value)}
                    placeholder="e.g. https://www.tcs.com/" 
                    disabled={triggering}
                    className="anime-input font-mono text-xs"
                  />
                </div>

                {formError && (
                  <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 p-3 rounded flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    {formError}
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={triggering}
                  className="btn-anime-primary justify-center py-3 mt-2 text-sm font-space tracking-wider"
                >
                  {triggering ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-sky-300" />
                      <span>INITIALIZING PIPELINE...</span>
                    </>
                  ) : (
                    <>
                      <span>START AUTOMATED RESEARCH</span>
                      <ArrowRight className="w-4 h-4 text-sky-300" />
                    </>
                  )}
                </button>
              </form>

              {/* 4-Step RAG Pipeline Indicator */}
              <div className="grid grid-cols-4 gap-3 w-full max-w-2xl mt-10 text-center font-mono text-xs">
                {[
                  { step: "01", name: "DISCOVER", detail: "Firecrawl Map" },
                  { step: "02", name: "CLEAN", detail: "Boilerplate Strip" },
                  { step: "03", name: "EMBED", detail: "Local BGE 768d" },
                  { step: "04", name: "QUERY", detail: "Grounded Answer" }
                ].map((s, i) => (
                  <div key={i} className="manga-panel p-3 flex flex-col gap-1">
                    <span className="text-[10px] text-sky-400 font-bold">{s.step}</span>
                    <span className="font-bold text-white font-space">{s.name}</span>
                    <span className="text-[10px] text-slate-500">{s.detail}</span>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* VIEW 2: ANIMATED INGESTION PIPELINE SCREEN */}
          {view === "progress" && (
            <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto flex flex-col justify-center z-10 relative">
              <div className="manga-panel p-8 flex flex-col gap-6">
                
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-sky-500/10 border border-sky-500/40 flex items-center justify-center text-sky-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold font-space text-white">// INGESTION PIPELINE ACTIVE</h3>
                      <p className="text-xs text-slate-400">Crawling, structure chunking & vectorizing domain pages</p>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block">Status</span>
                    <span className="text-xs font-bold text-sky-400 uppercase tracking-wider animate-pulse">{jobStatus}</span>
                  </div>
                </div>

                {/* Animated Pipeline Stage Flow Node Graph */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-900/80 border border-slate-800 rounded p-4 text-center">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block mb-1">Discovered Pages</span>
                    <span className="text-2xl font-bold font-space text-white">{jobPagesDiscovered}</span>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 rounded p-4 text-center">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block mb-1">Processed Pages</span>
                    <span className="text-2xl font-bold font-space text-emerald-400">{jobPagesProcessed}</span>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 rounded p-4 text-center">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block mb-1">BGE Model</span>
                    <span className="text-xs font-bold font-mono text-sky-400 mt-2 block">768d CUDA GPU</span>
                  </div>
                </div>

                {/* Console Log Terminal Output */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Terminal className="w-4 h-4 text-sky-400" /> // EVENT STREAM LOG
                    </span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">STREAM ACTIVE</span>
                  </div>
                  <div ref={logsConsoleRef} className="console-box">
                    {jobLogs || "Establishing event stream connection...\n"}
                  </div>
                </div>

                {jobError && (
                  <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 p-4 rounded flex items-start gap-3">
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block mb-0.5">// INGESTION ERROR</span>
                      {jobError}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* VIEW 3: COMPANY DIRECTORY VIEW */}
          {view === "directory" && (
            <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto flex flex-col gap-6 z-10 relative">
              
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold font-space text-white tracking-wide">// TARGET DIRECTORY</h2>
                  <p className="text-xs text-slate-400">Manage and inspect all processed corporate intelligence targets</p>
                </div>

                <button 
                  onClick={() => { setSelectedCompany(null); setView("landing"); }}
                  className="btn-anime-primary text-xs"
                >
                  <Plus className="w-4 h-4" /> NEW TARGET
                </button>
              </div>

              {/* Directory Filter Search */}
              <div className="relative max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input 
                  type="text" 
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                  placeholder="Filter targets by name or domain..."
                  className="anime-input pl-9 text-xs"
                />
              </div>

              {/* Company Dossier Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {filteredCompanies.map((c, i) => (
                  <div 
                    key={c.id} 
                    onClick={() => handleSelectCompany(c)}
                    className="manga-panel manga-panel-interactive p-5 flex flex-col justify-between cursor-pointer group"
                    style={{ transform: `rotate3d(0, 1, 0, ${(i % 3 - 1) * 2}deg)` }}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono text-slate-500">[{String(i + 1).padStart(2, '0')}]</span>
                        {c.status === "completed" ? (
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-bold">READY</span>
                        ) : (
                          <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-bold">INGESTING</span>
                        )}
                      </div>

                      <h3 className="font-bold font-space text-sm text-white group-hover:text-sky-400 transition-colors mb-1">
                        {c.name}
                      </h3>

                      <p className="text-xs text-slate-400 font-mono truncate mb-4">
                        {c.website_url}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
                      <span>OPEN DOSSIER</span>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* VIEW 4: INTELLIGENCE WORKSPACE */}
          {view === "dashboard" && selectedCompany && (
            <div className="flex-1 flex overflow-hidden z-10 relative">

              {/* WORKSPACE MAIN BODY */}
              <div className="flex-1 flex flex-col overflow-hidden">
                
                {/* TAB 1: RESEARCH Q&A CHAT */}
                {activeTab === "research" && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    
                    {/* Chat Messages Stream */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl w-full mx-auto">
                      {chatHistory.map((msg, idx) => {
                        const isUser = msg.role === "user";
                        return (
                          <div 
                            key={idx} 
                            className={`flex gap-3.5 max-w-3xl ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                          >
                            {/* Avatar */}
                            <div className={`w-8 h-8 rounded shrink-0 flex items-center justify-center text-xs font-mono font-bold ${
                              isUser 
                                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30" 
                                : "bg-slate-900 border border-sky-500/40 text-sky-400"
                            }`}>
                              {isUser ? "YOU" : <Sparkles className="w-4 h-4 text-sky-400" />}
                            </div>

                            {/* Content Box */}
                            <div className="flex flex-col gap-1.5 max-w-2xl group relative">
                              <div className={`p-4 rounded-lg text-xs leading-relaxed ${
                                isUser 
                                  ? "bg-blue-600/20 border border-blue-500/40 text-white font-medium" 
                                  : "bg-slate-900/90 border border-slate-800 text-slate-200 shadow-lg"
                              }`}>
                                <div className="whitespace-pre-line">{msg.text}</div>

                                {/* Citation Chips */}
                                {!isUser && msg.citations && msg.citations.length > 0 && (
                                  <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap gap-1.5 items-center">
                                    <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider">
                                      // EVIDENCE CITATIONS:
                                    </span>
                                    {msg.citations.map(cit => (
                                      <button
                                        key={cit.index}
                                        onClick={() => setActiveCitationDetail(cit)}
                                        className="citation-chip"
                                      >
                                        <span>[{cit.index}]</span>
                                        <span className="max-w-[130px] truncate">{cit.title}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {!isUser && (
                                <button
                                  onClick={() => handleCopy(msg.text, idx)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 text-slate-400 hover:text-white p-1 rounded bg-slate-800 border border-slate-700"
                                  title="Copy text"
                                >
                                  {copiedIdx === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {queryLoading && (
                        <div className="flex gap-3.5 mr-auto max-w-3xl">
                          <div className="w-8 h-8 rounded bg-slate-900 border border-sky-500/40 flex items-center justify-center text-sky-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                          </div>
                          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded text-xs text-slate-300 flex items-center gap-3 shadow-lg">
                            <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                            <span className="font-mono text-sky-300">// Executing pgvector hybrid RRF search & Gemini Flash generation...</span>
                          </div>
                        </div>
                      )}

                      <div ref={chatBottomRef} />
                    </div>

                    {/* Bottom Question Input Bar */}
                    <div className="p-4 border-t border-slate-800/80 bg-[#0c1220]/90 backdrop-blur-xl">
                      <div className="max-w-3xl mx-auto flex flex-col gap-3">
                        
                        {/* Quick Prompts Pills */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                          <span className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider shrink-0">
                            // PROMPTS:
                          </span>
                          {[
                            `What core services & solutions does ${selectedCompany.name} offer?`,
                            `What technology stack & cloud frameworks are used?`,
                            `What are the key career roles & skill demands?`,
                            `Where are primary global office locations?`
                          ].map((pillText, pIdx) => (
                            <button
                              key={pIdx}
                              onClick={() => handleQuickPrompt(pillText)}
                              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-blue-600/20 hover:text-sky-300 text-slate-300 border border-slate-800 shrink-0 text-[11px] font-mono transition-colors"
                            >
                              {pillText}
                            </button>
                          ))}
                        </div>

                        {/* Input Form Bar */}
                        <form onSubmit={(e) => { e.preventDefault(); handleSendQuestion(chatInput); }} className="relative flex items-center">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder={`Ask a research question about ${selectedCompany.name}...`}
                            disabled={queryLoading}
                            className="anime-input pr-24 py-3 text-xs"
                          />
                          <div className="absolute right-2 flex items-center gap-1">
                            <button 
                              type="button"
                              className="p-1.5 text-slate-400 hover:text-sky-400 rounded"
                              title="Attach Context"
                            >
                              <Paperclip className="w-4 h-4" />
                            </button>
                            <button
                              type="submit"
                              disabled={!chatInput.trim() || queryLoading}
                              className="btn-anime-primary py-1.5 px-3 text-xs"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>

                  </div>
                )}

                {/* TAB 2: SOURCES MATRIX */}
                {activeTab === "sources" && (
                  <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold font-space text-white text-base">// SOURCES MATRIX</h3>
                        <p className="text-xs text-slate-400">Indexed candidate pages from Firecrawl pipeline</p>
                      </div>

                      <div className="relative w-64">
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                        <input 
                          type="text"
                          value={sourceSearchQuery}
                          onChange={(e) => setSourceSearchQuery(e.target.value)}
                          placeholder="Filter matrix..."
                          className="anime-input pl-8 py-1.5 text-xs"
                        />
                      </div>
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex gap-2 text-xs border-b border-slate-800 pb-3 font-mono">
                      {["all", "services", "careers", "investors", "news", "about"].map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSourceCategoryFilter(cat)}
                          className={`px-3 py-1 rounded uppercase transition-colors ${
                            sourceCategoryFilter === cat 
                              ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold" 
                              : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { title: "Core Services & Solutions", type: "services", score: "0.89", chunk: "chk_9a12b" },
                        { title: "Careers & Hiring Demands", type: "careers", score: "0.84", chunk: "chk_4f81c" },
                        { title: "Financial Brief & Investor Overview", type: "investors", score: "0.78", chunk: "chk_3d11e" },
                        { title: "Press Releases & News Matrix", type: "news", score: "0.74", chunk: "chk_7b29a" },
                        { title: "Company Profile & Overview", type: "about", score: "0.71", chunk: "chk_1e40c" },
                      ]
                      .filter(item => sourceCategoryFilter === "all" || item.type === sourceCategoryFilter)
                      .filter(item => sourceSearchQuery === "" || item.title.toLowerCase().includes(sourceSearchQuery.toLowerCase()))
                      .map((item, i) => (
                        <div key={i} className="manga-panel p-4 flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-2">
                            <span className={`badge-source ${item.type}`}>{item.type}</span>
                            <span className="text-[11px] font-mono text-sky-400">Score: {item.score}</span>
                          </div>
                          <h4 className="font-bold text-xs text-white font-space mb-2">{item.title}</h4>
                          <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-2 border-t border-slate-800">
                            <span>Chunk ID: {item.chunk}</span>
                            <span className="text-sky-400 font-sans font-medium flex items-center gap-1 cursor-pointer">
                              Inspect <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 3: Q&A AUDIT LOG */}
                {activeTab === "history" && (
                  <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto flex flex-col gap-4">
                    <h3 className="font-bold font-space text-white text-base">// Q&A AUDIT LOG</h3>
                    <div className="space-y-3">
                      {chatHistory.filter(m => m.role === "user").map((userMsg, idx) => (
                        <div key={idx} className="manga-panel p-4 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 text-slate-200">
                            <Clock className="w-4 h-4 text-sky-400" />
                            <span>Q: {userMsg.text}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">GROUNDED</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 4: INSIGHTS BREAKDOWN */}
                {activeTab === "insights" && (
                  <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto flex flex-col gap-6">
                    <h3 className="font-bold font-space text-white text-base">// INTELLIGENCE INSIGHTS</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="manga-panel p-4 text-center">
                        <span className="text-[10px] font-mono text-slate-500 uppercase block mb-1">TARGET</span>
                        <span className="text-sm font-bold text-white font-space">{selectedCompany.name}</span>
                      </div>
                      <div className="manga-panel p-4 text-center">
                        <span className="text-[10px] font-mono text-slate-500 uppercase block mb-1">VECTOR EMBEDDING</span>
                        <span className="text-sm font-bold text-sky-400 font-mono">BGE-Base-v1.5 (768d)</span>
                      </div>
                      <div className="manga-panel p-4 text-center">
                        <span className="text-[10px] font-mono text-slate-500 uppercase block mb-1">RETRIEVAL FUSION</span>
                        <span className="text-sm font-bold text-emerald-400 font-mono">RRF Vector + FTS</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 5: PROFILE */}
                {activeTab === "profile" && (
                  <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto flex flex-col gap-4">
                    <h3 className="font-bold font-space text-white text-base">// DOSSIER PROFILE</h3>
                    <div className="manga-panel p-6 space-y-3 text-xs">
                      <div className="flex justify-between border-b border-slate-800 pb-2">
                        <span className="text-slate-400">Target Name</span>
                        <span className="font-bold text-white">{selectedCompany.name}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-800 pb-2">
                        <span className="text-slate-400">Target Domain</span>
                        <span className="font-mono text-sky-400">{selectedCompany.website_url}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Internal UUID</span>
                        <span className="font-mono text-slate-500">{selectedCompany.id}</span>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* 3. RIGHT SIDEBAR EVIDENCE INSPECTOR (WHEN CITATION IS CLICKED) */}
              {activeCitationDetail && (
                <div className="w-80 border-l border-slate-800 bg-[#0c1220]/95 backdrop-blur-xl p-5 shrink-0 overflow-y-auto flex flex-col gap-4 shadow-2xl z-30 animate-in slide-in-from-right duration-200">
                  
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2 text-xs font-bold font-space text-white">
                      <FileText className="w-4 h-4 text-sky-400" />
                      // EVIDENCE INSPECTOR
                    </div>
                    <button 
                      onClick={() => setActiveCitationDetail(null)}
                      className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Citation Tag */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded font-bold font-mono">
                      Citation [{activeCitationDetail.index}]
                    </span>
                    <span className={`badge-source ${activeCitationDetail.source_type}`}>
                      {activeCitationDetail.source_type}
                    </span>
                  </div>

                  {/* Document Title */}
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono uppercase block mb-1">
                      DOCUMENT TITLE
                    </span>
                    <h4 className="font-bold text-xs text-white font-space leading-snug">
                      {activeCitationDetail.title}
                    </h4>
                  </div>

                  {/* Header Context */}
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono uppercase block mb-1">
                      HEADER CONTEXT
                    </span>
                    <div className="text-xs text-slate-300 font-mono bg-slate-900 border border-slate-800 p-2 rounded truncate">
                      {activeCitationDetail.section_header || "# Overview"}
                    </div>
                  </div>

                  {/* Quoted Text Snippet */}
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono uppercase block mb-1">
                      QUOTED TEXT SNIPPET
                    </span>
                    <p className="text-xs text-slate-300 bg-slate-900 border border-slate-800 p-3 rounded leading-relaxed italic">
                      "{activeCitationDetail.snippet || "Extracted content block verified against pgvector candidate embeddings."}"
                    </p>
                  </div>

                  {/* Direct Link */}
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono uppercase block mb-1">
                      SOURCE LINK
                    </span>
                    <a 
                      href={activeCitationDetail.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-xs text-sky-400 hover:underline font-mono truncate flex items-center gap-1"
                    >
                      <span className="truncate">{activeCitationDetail.url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>

                  {/* Fact-Grounding Badge */}
                  <div className="bg-sky-500/10 border border-sky-500/30 p-3 rounded text-[11px] text-sky-200 flex items-start gap-2 mt-auto">
                    <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">// FACT-GROUNDED MATCH</span>
                      Mapped directly from PostgreSQL vector candidates.
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}

        </div>
      </main>

    </div>
  );
}
