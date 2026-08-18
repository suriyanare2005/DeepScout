import React, { useState, useEffect, useRef } from "react";
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
  Sparkles,
  Layers,
  Cpu,
  Briefcase,
  Database,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  BarChart3,
  ShieldCheck,
  ChevronRight
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
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  citations?: Citation[];
}

export default function App() {
  // Directory & Selection
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyItem | null>(null);
  
  // Navigation View: "landing" | "dashboard" | "chat" | "progress"
  const [view, setView] = useState<"landing" | "dashboard" | "chat" | "progress">("landing");
  
  // Dashboard Sub-Tab: "overview" | "products" | "tech" | "careers" | "sources"
  const [dashTab, setDashTab] = useState<"overview" | "products" | "tech" | "careers" | "sources">("overview");

  // Ingestion Form
  const [companyName, setCompanyName] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [triggering, setTriggering] = useState(false);
  const [formError, setFormError] = useState("");

  // Ingestion Job Tracker
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>("pending");
  const [jobPagesDiscovered, setJobPagesDiscovered] = useState(0);
  const [jobPagesProcessed, setJobPagesProcessed] = useState(0);
  const [jobLogs, setJobLogs] = useState("");
  const [jobError, setJobError] = useState("");

  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);
  const [activeCitationDetail, setActiveCitationDetail] = useState<Citation | null>(null);

  // Sources Table Search Filter
  const [sourceSearchQuery, setSourceSearchQuery] = useState("");

  // Auto-scroll references
  const logsConsoleRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

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
            text: `RAG intelligence base compiled! Ask any research question. All answers are grounded directly on vector-indexed source pages.`
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
    
    if (company.status === "completed") {
      setView("dashboard");
      loadChatHistory(company.id);
    } else if (company.status === "failed") {
      setView("landing");
    } else {
      setView("progress");
    }
  };

  // 5. Submit New Company Research
  const handleStartResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    
    if (!companyName.trim()) {
      setFormError("Please enter the company name.");
      return;
    }
    if (!companyUrl.trim()) {
      setFormError("Please enter the company website URL.");
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
          website_url: companyUrl.trim(),
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
            text: "Error: Failed to execute query. Check server logs." 
          }
        ]);
      }
    } catch (e) {
      setChatHistory(prev => [
        ...prev, 
        { 
          role: "assistant", 
          text: "Network link error. Please check server status." 
        }
      ]);
    } finally {
      setQueryLoading(false);
    }
  };

  // Quick Prompt Launcher
  const handleQuickPrompt = (promptText: string) => {
    setView("chat");
    handleSendQuestion(promptText);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden text-slate-100 bg-[#070b14] font-sans antialiased">
      
      {/* Ambient background glow mesh */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-violet-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-cyan-500/10 rounded-full blur-[130px]" />
      </div>

      {/* 1. LEFT SIDEBAR: Directory navigation */}
      <aside className="w-80 border-r border-slate-800/80 bg-[#060913]/90 backdrop-blur-xl flex flex-col shrink-0 z-10">
        
        {/* App Logo Header */}
        <div className="p-6 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-400 p-0.5 shadow-lg shadow-violet-500/20">
              <div className="w-full h-full bg-[#070b14] rounded-[10px] flex items-center justify-center">
                <Building2 className="w-5 h-5 text-violet-400" />
              </div>
            </div>
            <div>
              <h1 className="text-base font-bold font-outfit text-white tracking-tight leading-none mb-1">
                Company Research
              </h1>
              <span className="text-[10px] text-cyan-400 font-semibold tracking-widest uppercase flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" /> RAG Intelligence V1
              </span>
            </div>
          </div>
        </div>

        {/* Action: Research New Company */}
        <div className="p-4">
          <button 
            onClick={() => { setSelectedCompany(null); setView("landing"); }}
            className="w-full btn-primary justify-center text-sm py-3 shadow-violet-600/25"
          >
            <Plus className="w-4.5 h-4.5" />
            Research New Company
          </button>
        </div>

        {/* Researched Companies Directory */}
        <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1">
          <div className="px-3 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
            <span>Company Directory</span>
            <span className="text-[10px] bg-slate-800/60 px-2 py-0.5 rounded-full text-slate-400">{companies.length}</span>
          </div>
          
          {loadingCompanies && companies.length === 0 ? (
            <div className="flex justify-center items-center py-10 text-slate-500 gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
              <span className="text-xs">Loading directory...</span>
            </div>
          ) : companies.length === 0 ? (
            <div className="px-4 py-8 text-xs text-slate-500 text-center italic bg-slate-900/30 rounded-xl border border-slate-800/40">
              No companies researched yet.
            </div>
          ) : (
            companies.map(c => {
              const isActive = selectedCompany?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => handleSelectCompany(c)}
                  className={`group relative p-3 rounded-xl text-left transition-all flex flex-col gap-1.5 border ${
                    isActive 
                      ? "bg-violet-950/40 border-violet-500/40 text-white shadow-lg shadow-violet-900/20" 
                      : "bg-slate-900/20 border-transparent hover:bg-slate-900/50 hover:border-slate-800/80 text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`font-semibold text-sm truncate pr-2 ${isActive ? "text-white font-outfit" : "text-slate-200 group-hover:text-white"}`}>
                      {c.name}
                    </span>
                    
                    {c.status === "completed" && (
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Active
                      </span>
                    )}
                    {c.status === "failed" && (
                      <span className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                        <AlertCircle className="w-2.5 h-2.5" /> Failed
                      </span>
                    )}
                    {(c.status === "pending" || c.status === "running") && (
                      <span className="text-[9px] bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse flex items-center gap-1">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Crawl
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-slate-500 truncate flex items-center gap-1.5 font-mono">
                    <Globe className="w-3 h-3 text-slate-600 shrink-0" />
                    {c.website_url.replace(/^https?:\/\//, "")}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Sidebar Footer Metadata */}
        <div className="p-4 border-t border-slate-800/80 bg-[#04060d]/80 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-violet-400" />
            <span>Local BGE (768d)</span>
          </div>
          <span className="text-[10px] bg-slate-800/80 text-slate-400 px-2 py-0.5 rounded font-mono">CUDA GPU</span>
        </div>

      </aside>

      {/* 2. MAIN WORKSPACE */}
      <main className="flex-1 bg-[#090d16] flex flex-col relative overflow-hidden z-10">
        
        {/* TOP NAVBAR / HEADER */}
        <header className="h-16 border-b border-slate-800/80 bg-[#060913]/70 backdrop-blur-xl px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            {selectedCompany ? (
              <>
                <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-bold text-white font-outfit text-base leading-none mb-0.5 flex items-center gap-2">
                    {selectedCompany.name}
                    <a 
                      href={selectedCompany.website_url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-xs text-slate-500 hover:text-violet-400 font-normal transition-colors flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </h2>
                  <span className="text-xs text-slate-400 font-mono">{selectedCompany.website_url}</span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-slate-400 font-outfit font-semibold text-sm">
                <Sparkles className="w-4 h-4 text-violet-400" />
                Select or Research a Company to Begin
              </div>
            )}
          </div>

          {/* Navigation View Switcher Tabs (when company selected & completed) */}
          {selectedCompany && selectedCompany.status === "completed" && (
            <div className="flex bg-slate-900/60 p-1 rounded-xl border border-slate-800/80 gap-1">
              <button
                onClick={() => setView("dashboard")}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  view === "dashboard"
                    ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" /> Intelligence Dashboard
              </button>

              <button
                onClick={() => setView("chat")}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  view === "chat"
                    ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" /> Grounded Q&A Chat
              </button>
            </div>
          )}
        </header>

        {/* WORKSPACE CONTENT VIEWS */}
        <div className="flex-1 overflow-hidden relative flex">

          {/* VIEW 1: LANDING FORM */}
          {view === "landing" && (
            <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-8 max-w-3xl mx-auto">
              
              {/* Hero Banner */}
              <div className="relative mb-8 text-center">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-400 p-1 shadow-2xl shadow-violet-500/30 mx-auto mb-6">
                  <div className="w-full h-full bg-[#070b14] rounded-[22px] flex items-center justify-center">
                    <Search className="w-9 h-9 text-violet-400" />
                  </div>
                </div>

                <h1 className="text-4xl font-extrabold text-white mb-3 font-outfit tracking-tight heading-premium">
                  Automated Corporate Intelligence RAG
                </h1>
                
                <p className="text-slate-400 text-sm max-w-lg mx-auto leading-relaxed">
                  Deep Firecrawl web ingestion + BGE local vector embeddings + hybrid RRF retrieval + Gemini grounded generation with verifiable citations.
                </p>
              </div>

              {/* Research Form Box */}
              <form onSubmit={handleStartResearch} className="glass-card p-8 w-full max-w-xl flex flex-col gap-5 border border-slate-800/80 shadow-2xl">
                
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2 font-outfit">
                    <Building2 className="w-4 h-4 text-violet-400" /> Company Name
                  </label>
                  <input 
                    type="text" 
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Tata Consultancy Services" 
                    disabled={triggering}
                    className="input-field py-3 bg-slate-950/60 border-slate-800 text-white font-medium"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2 font-outfit">
                    <Globe className="w-4 h-4 text-cyan-400" /> Domain Website URL
                  </label>
                  <input 
                    type="text" 
                    value={companyUrl}
                    onChange={(e) => setCompanyUrl(e.target.value)}
                    placeholder="e.g. https://www.tcs.com/" 
                    disabled={triggering}
                    className="input-field py-3 bg-slate-950/60 border-slate-800 text-white font-mono text-sm"
                  />
                </div>

                {formError && (
                  <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl flex items-center gap-2">
                    <XCircle className="w-4 h-4 shrink-0" />
                    {formError}
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={triggering}
                  className="btn-primary mt-2 justify-center w-full py-3.5 text-base shadow-violet-600/30 font-outfit tracking-wide"
                >
                  {triggering ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Initializing Pipeline...
                    </>
                  ) : (
                    <>
                      Start Company Research
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                {/* Features Pills */}
                <div className="pt-4 border-t border-slate-800/60 flex items-center justify-around text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1.5 text-slate-400"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Zero Hallucinations</span>
                  <span className="flex items-center gap-1.5 text-slate-400"><Cpu className="w-3.5 h-3.5 text-violet-400" /> BGE CUDA Local</span>
                  <span className="flex items-center gap-1.5 text-slate-400"><Database className="w-3.5 h-3.5 text-cyan-400" /> Neon pgvector</span>
                </div>

              </form>
            </div>
          )}

          {/* VIEW 2: PROGRESS LOGGING CONSOLE */}
          {view === "progress" && (
            <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto flex flex-col justify-center">
              
              <div className="glass-card p-8 flex flex-col gap-6 border-slate-800/80 shadow-2xl">
                
                <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white font-outfit">Ingestion Pipeline In Progress</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Firecrawl scan → Content cleaner → Structure chunker → BGE CUDA vectorizer</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block">Status</span>
                    <span className="text-sm font-bold text-violet-400 uppercase tracking-wider animate-pulse">{jobStatus}</span>
                  </div>
                </div>

                {/* Progress Metric Box */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 text-center">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Discovered Pages</span>
                    <span className="text-3xl font-extrabold text-white font-outfit">{jobPagesDiscovered}</span>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 text-center">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Processed Pages</span>
                    <span className="text-3xl font-extrabold text-emerald-400 font-outfit">{jobPagesProcessed}</span>
                  </div>
                </div>

                {/* Logs Terminal */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider font-outfit">
                    <span className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-emerald-400" /> Live Crawler Event Logs
                    </span>
                    <span className="text-[10px] font-mono text-emerald-500/80 bg-emerald-500/10 px-2 py-0.5 rounded">Streaming</span>
                  </div>
                  <div ref={logsConsoleRef} className="console-box border-slate-800/80 shadow-inner text-xs">
                    {jobLogs || "Connecting to socket event log stream...\n"}
                  </div>
                </div>

                {jobError && (
                  <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-start gap-3">
                    <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-sm block mb-1">Pipeline Execution Error</span>
                      {jobError}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 3: INTELLIGENCE DASHBOARD */}
          {view === "dashboard" && selectedCompany && (
            <div className="flex-1 overflow-y-auto p-8 max-w-6xl mx-auto flex flex-col gap-6">
              
              {/* Dashboard Sub-Tabs Header */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div className="flex gap-2 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80">
                  <button
                    onClick={() => setDashTab("overview")}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 font-outfit ${
                      dashTab === "overview" ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" /> Overview
                  </button>

                  <button
                    onClick={() => setDashTab("products")}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 font-outfit ${
                      dashTab === "products" ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Products & Solutions
                  </button>

                  <button
                    onClick={() => setDashTab("tech")}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 font-outfit ${
                      dashTab === "tech" ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5" /> Tech Stack
                  </button>

                  <button
                    onClick={() => setDashTab("careers")}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 font-outfit ${
                      dashTab === "careers" ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Briefcase className="w-3.5 h-3.5" /> Careers & Hiring
                  </button>

                  <button
                    onClick={() => setDashTab("sources")}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 font-outfit ${
                      dashTab === "sources" ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" /> Crawled Evidence Matrix
                  </button>
                </div>

                <button 
                  onClick={() => setView("chat")}
                  className="btn-primary py-2 text-xs"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Ask Questions in Chat
                </button>
              </div>

              {/* DASHBOARD TAB 1: OVERVIEW */}
              {dashTab === "overview" && (
                <div className="flex flex-col gap-6">
                  
                  {/* Top Stats Cards Grid */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="glass-card p-5 border-slate-800/80">
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Company Target</span>
                      <span className="text-lg font-bold text-white font-outfit truncate block">{selectedCompany.name}</span>
                    </div>

                    <div className="glass-card p-5 border-slate-800/80">
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Vector Model</span>
                      <span className="text-lg font-bold text-violet-400 font-outfit block">BGE-Base-v1.5</span>
                    </div>

                    <div className="glass-card p-5 border-slate-800/80">
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Embedding Dimensions</span>
                      <span className="text-lg font-bold text-cyan-400 font-outfit block">768-Dim (CUDA)</span>
                    </div>

                    <div className="glass-card p-5 border-slate-800/80">
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Retrieval Fusion</span>
                      <span className="text-lg font-bold text-emerald-400 font-outfit block">RRF Hybrid</span>
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div className="glass-card p-6 border-slate-800/80 flex flex-col gap-4">
                    <h3 className="text-lg font-bold text-white font-outfit flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-violet-400" /> Executive Research Profile
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {selectedCompany.name} has been parsed, structure-chunked, and vectorized into the Neon PostgreSQL database.
                      Use the quick launch prompts below or open the Grounded Q&A Chat to ask detailed questions about products, stack, career opportunities, or corporate governance.
                    </p>

                    {/* Quick Launch Prompts */}
                    <div className="pt-4 border-t border-slate-800/80 flex flex-col gap-3">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest font-outfit">
                        Quick Launch Research Questions:
                      </span>
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => handleQuickPrompt(`What core IT services, digital solutions, and cloud products does ${selectedCompany.name} offer?`)}
                          className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-violet-500/50 hover:bg-slate-900/60 text-left text-xs text-slate-200 transition-all flex items-center justify-between group"
                        >
                          <span>What products and solutions does {selectedCompany.name} offer?</span>
                          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-violet-400 transition-colors" />
                        </button>

                        <button 
                          onClick={() => handleQuickPrompt(`What technology stack, cloud platforms, and engineering frameworks does ${selectedCompany.name} use?`)}
                          className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-violet-500/50 hover:bg-slate-900/60 text-left text-xs text-slate-200 transition-all flex items-center justify-between group"
                        >
                          <span>What tech stack & cloud platforms do they use?</span>
                          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-violet-400 transition-colors" />
                        </button>

                        <button 
                          onClick={() => handleQuickPrompt(`What are the key career roles, hiring requirements, and skills demanded at ${selectedCompany.name}?`)}
                          className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-violet-500/50 hover:bg-slate-900/60 text-left text-xs text-slate-200 transition-all flex items-center justify-between group"
                        >
                          <span>What skills & career opportunities do they offer?</span>
                          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-violet-400 transition-colors" />
                        </button>

                        <button 
                          onClick={() => handleQuickPrompt(`What are ${selectedCompany.name}'s primary office locations, global sites, and headquarters?`)}
                          className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-violet-500/50 hover:bg-slate-900/60 text-left text-xs text-slate-200 transition-all flex items-center justify-between group"
                        >
                          <span>Where are their primary global office locations?</span>
                          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-violet-400 transition-colors" />
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* DASHBOARD TAB 2: PRODUCTS */}
              {dashTab === "products" && (
                <div className="glass-card p-6 border-slate-800/80 flex flex-col gap-4">
                  <h3 className="text-lg font-bold text-white font-outfit flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-violet-400" /> Products & Solutions Portfolio
                  </h3>
                  <p className="text-sm text-slate-300">
                    Click the question below to run vector retrieval and generate a grounded breakdown of products and services:
                  </p>
                  <button 
                    onClick={() => handleQuickPrompt(`Provide a comprehensive breakdown of ${selectedCompany.name}'s flagship products, platforms, and services with citations.`)}
                    className="btn-primary py-3 w-fit text-xs"
                  >
                    Analyze Product & Service Portfolio
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* DASHBOARD TAB 3: TECH STACK */}
              {dashTab === "tech" && (
                <div className="glass-card p-6 border-slate-800/80 flex flex-col gap-4">
                  <h3 className="text-lg font-bold text-white font-outfit flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-cyan-400" /> Technology & Infrastructure Stack
                  </h3>
                  <div className="flex flex-wrap gap-2 py-2">
                    {["PostgreSQL", "pgvector", "Python", "FastAPI", "React", "TypeScript", "BGE Embeddings", "PyTorch CUDA", "Gemini 3.6 Flash", "Firecrawl", "AWS", "Oracle Cloud", "Microsoft Azure", "Google Cloud"].map((tech, i) => (
                      <span key={i} className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-800 text-cyan-300 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        {tech}
                      </span>
                    ))}
                  </div>
                  <button 
                    onClick={() => handleQuickPrompt(`What programming languages, cloud frameworks, and databases does ${selectedCompany.name} utilize?`)}
                    className="btn-primary py-3 w-fit text-xs mt-2"
                  >
                    Query Discovered Technical Stack
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* DASHBOARD TAB 4: CAREERS */}
              {dashTab === "careers" && (
                <div className="glass-card p-6 border-slate-800/80 flex flex-col gap-4">
                  <h3 className="text-lg font-bold text-white font-outfit flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-emerald-400" /> Career Opportunities & Skills
                  </h3>
                  <p className="text-sm text-slate-300">
                    Query job listings, career openings, and skill demands extracted from the company site:
                  </p>
                  <button 
                    onClick={() => handleQuickPrompt(`What are the key technical skills, engineering requirements, and career opportunities at ${selectedCompany.name}?`)}
                    className="btn-primary py-3 w-fit text-xs"
                  >
                    Extract Hiring & Skill Demands
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* DASHBOARD TAB 5: SOURCES MATRIX */}
              {dashTab === "sources" && (
                <div className="glass-card p-6 border-slate-800/80 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white font-outfit flex items-center gap-2">
                      <FileText className="w-5 h-5 text-violet-400" /> Indexed Web Pages Matrix
                    </h3>
                    <div className="relative w-64">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                      <input 
                        type="text"
                        value={sourceSearchQuery}
                        onChange={(e) => setSourceSearchQuery(e.target.value)}
                        placeholder="Search sources..."
                        className="input-field text-xs pl-9 py-2 bg-slate-950/60"
                      />
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    All pages below were discovered by Firecrawl, cleaned, structure-chunked, and vectorized into Neon PostgreSQL.
                  </p>
                </div>
              )}

            </div>
          )}

          {/* VIEW 4: CHAT WORKSPACE (Grounded Q&A interface) */}
          {view === "chat" && (
            <div className="flex-1 flex flex-col overflow-hidden relative">
              
              {/* Message Feed Stream */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {chatHistory.map((msg, idx) => {
                  const isUser = msg.role === "user";
                  return (
                    <div 
                      key={idx} 
                      className={`flex gap-4 max-w-3xl ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                    >
                      {/* Avatar Icon */}
                      <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-md ${isUser ? "bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-violet-500/20" : "bg-slate-900 border border-slate-800 text-violet-400"}`}>
                        {isUser ? "You" : <Sparkles className="w-4.5 h-4.5 text-violet-400" />}
                      </div>
                      
                      {/* Content Box */}
                      <div className="flex flex-col gap-2 max-w-2xl">
                        <div className={`p-5 rounded-2xl text-sm leading-relaxed shadow-lg ${isUser ? "bg-violet-600/20 border border-violet-500/30 text-slate-100 rounded-tr-none" : "bg-[#101524] border border-slate-800 text-slate-200 rounded-tl-none"}`}>
                          
                          {/* Answer Content */}
                          <div className="whitespace-pre-line">{msg.text}</div>
                          
                          {/* Citation Chips Grid */}
                          {!isUser && msg.citations && msg.citations.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap gap-2 items-center">
                              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1 font-outfit">
                                <FileText className="w-3 h-3 text-violet-400" /> Evidence Citations:
                              </span>
                              {msg.citations.map(cit => (
                                <button
                                  key={cit.index}
                                  onClick={() => setActiveCitationDetail(cit)}
                                  className="text-xs bg-slate-950 border border-slate-800 hover:border-violet-500/60 hover:bg-violet-950/30 px-3 py-1 rounded-lg flex items-center gap-2 transition-all text-slate-200 font-medium group shadow-sm"
                                >
                                  <span className="text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded font-bold font-mono">[{cit.index}]</span>
                                  <span className="max-w-[140px] truncate group-hover:text-white">{cit.title}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {queryLoading && (
                  <div className="flex gap-4 mr-auto max-w-3xl">
                    <div className="w-9 h-9 rounded-xl shrink-0 bg-slate-900 border border-slate-800 flex items-center justify-center">
                      <Loader2 className="w-4.5 h-4.5 animate-spin text-violet-400" />
                    </div>
                    <div className="bg-[#101524] border border-slate-800 p-5 rounded-2xl text-sm text-slate-300 flex items-center gap-3 rounded-tl-none shadow-lg">
                      <Loader2 className="w-5 h-5 animate-spin text-violet-400 shrink-0" />
                      <div>
                        <span className="font-semibold text-white block">Executing Hybrid RRF Vector Search...</span>
                        <span className="text-xs text-slate-400 font-mono">pgvector (768d) + FTS tsvector → Gemini 3.6 Flash</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Message Input Footer */}
              <div className="p-6 border-t border-slate-800/80 bg-[#060913]/80 backdrop-blur-xl">
                <form onSubmit={(e) => { e.preventDefault(); handleSendQuestion(chatInput); }} className="max-w-3xl mx-auto relative flex items-center">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={`Ask any research question about ${selectedCompany?.name || "this company"}...`}
                    disabled={queryLoading}
                    className="input-field pr-14 py-4 bg-slate-950/80 border-slate-800 text-sm shadow-xl focus:border-violet-500"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || queryLoading}
                    className="absolute right-3 p-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40 disabled:hover:bg-violet-600 transition-all shadow-md shadow-violet-600/30"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>

            </div>
          )}

          {/* 3. RIGHT SIDEBAR EVIDENCE DRAWER */}
          {activeCitationDetail && (
            <div className="w-80 border-l border-slate-800/80 bg-[#060913]/95 backdrop-blur-2xl p-6 shrink-0 overflow-y-auto flex flex-col gap-6 absolute right-0 top-0 bottom-0 z-20 shadow-2xl animate-in slide-in-from-right duration-200">
              
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2 text-sm font-bold text-white font-outfit">
                  <FileText className="w-4.5 h-4.5 text-violet-400" />
                  Verified Evidence Source
                </div>
                <button 
                  onClick={() => setActiveCitationDetail(null)}
                  className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-slate-800/50 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Title & Index */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded font-bold font-mono">
                    Citation [{activeCitationDetail.index}]
                  </span>
                  <span className={`badge-source ${activeCitationDetail.source_type}`}>
                    {activeCitationDetail.source_type}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-white font-outfit leading-snug">
                  {activeCitationDetail.title}
                </h4>
              </div>

              {/* Section Header */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                  Document Heading Context
                </span>
                <span className="text-xs text-slate-200 font-mono bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl truncate">
                  {activeCitationDetail.section_header}
                </span>
              </div>

              {/* Source URL Link */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                  Web Source URL
                </span>
                <a 
                  href={activeCitationDetail.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-xs text-violet-400 hover:text-violet-300 break-all flex items-center gap-1.5 transition-colors bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80"
                >
                  <span className="truncate flex-1 font-mono">{activeCitationDetail.url}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              </div>

              {/* Grounding Notice */}
              <div className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-xl text-xs text-slate-400 flex flex-col gap-2 shadow-inner mt-auto">
                <div className="flex items-center gap-1.5 font-bold text-slate-200 font-outfit">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Fact-Grounding Trace
                </div>
                Mapped directly from pgvector candidate chunks. Zero hallucination policy enforced.
              </div>

            </div>
          )}

        </div>
      </main>

    </div>
  );
}
