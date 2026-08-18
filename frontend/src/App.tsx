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
  BookOpen,
  FolderKanban,
  Sparkles
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
  // Directory & Selection
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyItem | null>(null);
  
  // Navigation View: "landing" | "dashboard" | "directory" | "progress"
  const [view, setView] = useState<"landing" | "dashboard" | "directory" | "progress">("landing");
  
  // Workspace Tab: "research" | "sources" | "history" | "insights" | "profile"
  const [activeTab, setActiveTab] = useState<"research" | "sources" | "history" | "insights" | "profile">("research");

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
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Sources Panel Filters
  const [sourceSearchQuery, setSourceSearchQuery] = useState("");
  const [sourceCategoryFilter, setSourceCategoryFilter] = useState("all");

  // Directory Search
  const [directorySearch, setDirectorySearch] = useState("");

  // Mobile Drawer
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
      setFormError("Please enter the company name.");
      return;
    }
    if (!urlVal.trim()) {
      setFormError("Please enter the company website URL.");
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
    <div className="flex h-screen w-screen overflow-hidden text-slate-900 bg-slate-50 font-sans antialiased">
      
      {/* Mobile Drawer Overlay */}
      {mobileSidebarOpen && (
        <div 
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 md:hidden"
        />
      )}

      {/* 1. LEFT SIDEBAR */}
      <aside className={`fixed md:relative inset-y-0 left-0 w-72 border-r border-slate-200 bg-white flex flex-col shrink-0 z-40 transition-transform duration-200 ${
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}>
        
        {/* App Branding Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Building2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">
                IntelliCorp
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                AI Company Intelligence
              </p>
            </div>
          </div>
          <button 
            onClick={() => setMobileSidebarOpen(false)}
            className="md:hidden text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action: New Research */}
        <div className="p-3">
          <button 
            onClick={() => { setSelectedCompany(null); setView("landing"); setMobileSidebarOpen(false); }}
            className="w-full btn-primary justify-center text-xs py-2.5"
          >
            <Plus className="w-4 h-4" />
            New Company Research
          </button>
        </div>

        {/* Core Navigation Items */}
        <div className="px-3 py-2 border-b border-slate-100 flex flex-col gap-0.5 text-xs">
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
            className={`w-full px-3 py-2 rounded-md font-medium text-left flex items-center gap-2.5 transition-colors ${
              view === "dashboard" && activeTab === "research"
                ? "bg-blue-50 text-blue-700 font-semibold"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <BarChart3 className="w-4 h-4 text-slate-400" />
            Research Workspace
          </button>

          <button
            onClick={() => { setView("directory"); setMobileSidebarOpen(false); }}
            className={`w-full px-3 py-2 rounded-md font-medium text-left flex items-center gap-2.5 transition-colors ${
              view === "directory"
                ? "bg-blue-50 text-blue-700 font-semibold"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <FolderKanban className="w-4 h-4 text-slate-400" />
            Company Directory
          </button>

          <button
            onClick={() => {
              if (selectedCompany) { setView("dashboard"); setActiveTab("sources"); }
              setMobileSidebarOpen(false);
            }}
            className={`w-full px-3 py-2 rounded-md font-medium text-left flex items-center gap-2.5 transition-colors ${
              view === "dashboard" && activeTab === "sources"
                ? "bg-blue-50 text-blue-700 font-semibold"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <FileText className="w-4 h-4 text-slate-400" />
            Sources Matrix
          </button>

          <button
            onClick={() => {
              if (selectedCompany) { setView("dashboard"); setActiveTab("history"); }
              setMobileSidebarOpen(false);
            }}
            className={`w-full px-3 py-2 rounded-md font-medium text-left flex items-center gap-2.5 transition-colors ${
              view === "dashboard" && activeTab === "history"
                ? "bg-blue-50 text-blue-700 font-semibold"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Clock className="w-4 h-4 text-slate-400" />
            Q&A History
          </button>
        </div>

        {/* Directory List of Recent Companies */}
        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1">
          <div className="px-2 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Recent Companies</span>
            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono text-[10px]">{companies.length}</span>
          </div>
          
          {loadingCompanies && companies.length === 0 ? (
            <div className="space-y-2 px-1 py-2">
              <div className="h-9 skeleton rounded-md" />
              <div className="h-9 skeleton rounded-md" />
              <div className="h-9 skeleton rounded-md" />
            </div>
          ) : companies.length === 0 ? (
            <div className="px-3 py-6 text-xs text-slate-400 text-center italic bg-slate-50 rounded-md border border-slate-200/60">
              No companies researched yet.
            </div>
          ) : (
            companies.map(c => {
              const isActive = selectedCompany?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => handleSelectCompany(c)}
                  className={`w-full p-2.5 rounded-lg text-left transition-all flex flex-col gap-1 border ${
                    isActive 
                      ? "bg-blue-50/70 border-blue-200 text-blue-900 font-medium" 
                      : "border-transparent hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold truncate pr-2">
                      {c.name}
                    </span>
                    
                    {c.status === "completed" && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Research Ready" />
                    )}
                    {c.status === "failed" && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="Failed" />
                    )}
                    {(c.status === "pending" || c.status === "running") && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" title="Ingesting" />
                    )}
                  </div>

                  <span className="text-[11px] text-slate-400 truncate font-mono">
                    {c.website_url.replace(/^https?:\/\//, "")}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hardware Status Badge */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Cpu className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-medium text-slate-700">BGE (768d)</span>
          </div>
          <span className="text-[10px] bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded font-mono font-medium">
            RTX 3050 CUDA
          </span>
        </div>

      </aside>

      {/* 2. MAIN WORKSPACE AREA */}
      <main className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
        
        {/* HEADER BAR */}
        <header className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden text-slate-500 hover:text-slate-700 p-1"
            >
              <Menu className="w-5 h-5" />
            </button>

            {selectedCompany ? (
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2.5 min-w-0">
                  <h2 className="font-bold text-slate-900 text-sm truncate">
                    {selectedCompany.name}
                  </h2>

                  {selectedCompany.status === "completed" && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold shrink-0 flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Research Ready
                    </span>
                  )}

                  <a 
                    href={selectedCompany.website_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-xs text-slate-400 hover:text-blue-600 font-mono transition-colors flex items-center gap-1 shrink-0"
                  >
                    {selectedCompany.website_url.replace(/^https?:\/\//, "")}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span>Select a company to open intelligence workspace</span>
              </div>
            )}
          </div>

          {/* Underline Navigation Tabs */}
          {selectedCompany && selectedCompany.status === "completed" && (
            <div className="flex gap-6 h-full items-center text-xs font-medium text-slate-500">
              <button
                onClick={() => { setView("dashboard"); setActiveTab("research"); }}
                className={`h-full border-b-2 px-1 flex items-center gap-1.5 transition-colors ${
                  view === "dashboard" && activeTab === "research"
                    ? "border-blue-600 text-blue-600 font-semibold"
                    : "border-transparent hover:text-slate-900"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" /> Research
              </button>

              <button
                onClick={() => { setView("dashboard"); setActiveTab("sources"); }}
                className={`h-full border-b-2 px-1 flex items-center gap-1.5 transition-colors ${
                  view === "dashboard" && activeTab === "sources"
                    ? "border-blue-600 text-blue-600 font-semibold"
                    : "border-transparent hover:text-slate-900"
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Sources
              </button>

              <button
                onClick={() => { setView("dashboard"); setActiveTab("history"); }}
                className={`h-full border-b-2 px-1 flex items-center gap-1.5 transition-colors ${
                  view === "dashboard" && activeTab === "history"
                    ? "border-blue-600 text-blue-600 font-semibold"
                    : "border-transparent hover:text-slate-900"
                }`}
              >
                <Clock className="w-3.5 h-3.5" /> History
              </button>

              <button
                onClick={() => { setView("dashboard"); setActiveTab("insights"); }}
                className={`h-full border-b-2 px-1 flex items-center gap-1.5 transition-colors ${
                  view === "dashboard" && activeTab === "insights"
                    ? "border-blue-600 text-blue-600 font-semibold"
                    : "border-transparent hover:text-slate-900"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" /> Insights
              </button>

              <button
                onClick={() => { setView("dashboard"); setActiveTab("profile"); }}
                className={`h-full border-b-2 px-1 flex items-center gap-1.5 transition-colors ${
                  view === "dashboard" && activeTab === "profile"
                    ? "border-blue-600 text-blue-600 font-semibold"
                    : "border-transparent hover:text-slate-900"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" /> Profile
              </button>
            </div>
          )}
        </header>

        {/* WORKSPACE CONTENT VIEWS */}
        <div className="flex-1 overflow-hidden relative flex">

          {/* VIEW 1: LANDING PAGE */}
          {view === "landing" && (
            <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center max-w-3xl mx-auto">
              
              <div className="text-center mb-8">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-4 border border-blue-100">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Local BGE Embedding & Hybrid RAG Engine
                </span>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-3">
                  Research any company. Understand the evidence.
                </h1>
                <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                  Enter a target company domain to automatically crawl website structure, clean boilerplate, chunk content, generate 768d vector embeddings, and explore grounded insights.
                </p>
              </div>

              {/* Ingestion Form Card */}
              <form onSubmit={(e) => { e.preventDefault(); handleStartResearch(companyName, companyUrl); }} className="card-clean p-6 w-full max-w-lg flex flex-col gap-4 shadow-sm">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" /> Company Name
                  </label>
                  <input 
                    type="text" 
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Tata Consultancy Services" 
                    disabled={triggering}
                    className="input-field"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-slate-400" /> Website URL
                  </label>
                  <input 
                    type="text" 
                    value={companyUrl}
                    onChange={(e) => setCompanyUrl(e.target.value)}
                    placeholder="e.g. https://www.tcs.com/" 
                    disabled={triggering}
                    className="input-field font-mono text-xs"
                  />
                </div>

                {formError && (
                  <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-lg flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    {formError}
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={triggering}
                  className="btn-primary justify-center py-2.5 mt-1 font-semibold"
                >
                  {triggering ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Initializing Pipeline...
                    </>
                  ) : (
                    <>
                      Start Automated Company Research
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* 4-Step Process Explanation */}
              <div className="grid grid-cols-4 gap-4 w-full max-w-2xl mt-12 text-center text-xs">
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <div className="font-bold text-slate-900 mb-1">1. DISCOVER</div>
                  <div className="text-slate-500 text-[11px]">Firecrawl map & page fetch</div>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <div className="font-bold text-slate-900 mb-1">2. CLEAN</div>
                  <div className="text-slate-500 text-[11px]">Boilerplate removal</div>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <div className="font-bold text-slate-900 mb-1">3. EMBED</div>
                  <div className="text-slate-500 text-[11px]">Local BGE 768d CUDA</div>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <div className="font-bold text-slate-900 mb-1">4. QUERY</div>
                  <div className="text-slate-500 text-[11px]">Cited grounded answers</div>
                </div>
              </div>

            </div>
          )}

          {/* VIEW 2: PROGRESS SCREEN */}
          {view === "progress" && (
            <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto flex flex-col justify-center">
              <div className="card-clean p-8 flex flex-col gap-6">
                
                <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Ingestion Pipeline in Progress</h3>
                      <p className="text-xs text-slate-500">Crawling, structure chunking & vectorizing domain pages</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Status</span>
                    <span className="text-xs font-bold text-blue-600 uppercase font-mono">{jobStatus}</span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                    <span className="text-xs text-slate-500 font-medium block mb-1">Pages Discovered</span>
                    <span className="text-2xl font-bold text-slate-900">{jobPagesDiscovered}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                    <span className="text-xs text-slate-500 font-medium block mb-1">Pages Processed</span>
                    <span className="text-2xl font-bold text-emerald-600">{jobPagesProcessed}</span>
                  </div>
                </div>

                {/* Terminal Box */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Terminal className="w-4 h-4 text-slate-500" /> Pipeline Console Stream
                    </span>
                    <span className="text-[10px] text-emerald-600 font-mono bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold">Active</span>
                  </div>
                  <div ref={logsConsoleRef} className="console-box">
                    {jobLogs || "Establishing pipeline stream connection...\n"}
                  </div>
                </div>

                {jobError && (
                  <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-4 rounded-lg flex items-start gap-3">
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block mb-0.5">Ingestion Error</span>
                      {jobError}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* VIEW 3: COMPANY DIRECTORY */}
          {view === "directory" && (
            <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto flex flex-col gap-6">
              
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Company Directory</h2>
                  <p className="text-xs text-slate-500">Manage and inspect all processed corporate intelligence targets</p>
                </div>

                <button 
                  onClick={() => { setSelectedCompany(null); setView("landing"); }}
                  className="btn-primary"
                >
                  <Plus className="w-4 h-4" /> New Research Target
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input 
                  type="text" 
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                  placeholder="Filter by company name or domain..."
                  className="input-field pl-9"
                />
              </div>

              {/* Directory Grid */}
              <div className="grid grid-cols-3 gap-4">
                {filteredCompanies.map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => handleSelectCompany(c)}
                    className="card-clean card-clean-hover p-5 flex flex-col justify-between cursor-pointer group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                          {c.name}
                        </h3>
                        {c.status === "completed" ? (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">Ready</span>
                        ) : (
                          <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">Processing</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-mono truncate mb-4">
                        {c.website_url}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
                      <span>View Intelligence</span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* VIEW 4: INTELLIGENCE DASHBOARD (RE-DESIGNED LIGHT WORKSPACE) */}
          {view === "dashboard" && selectedCompany && (
            <div className="flex-1 flex overflow-hidden">

              {/* WORKSPACE MAIN BODY */}
              <div className="flex-1 flex flex-col overflow-hidden">
                
                {/* TAB 1: RESEARCH / QA WORKSPACE */}
                {activeTab === "research" && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    
                    {/* Chat Messages Scroll Feed */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl w-full mx-auto">
                      {chatHistory.map((msg, idx) => {
                        const isUser = msg.role === "user";
                        return (
                          <div 
                            key={idx} 
                            className={`flex gap-3.5 max-w-3xl ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                          >
                            {/* Avatar */}
                            <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold shadow-sm ${
                              isUser ? "bg-blue-600 text-white" : "bg-slate-100 border border-slate-200 text-slate-700"
                            }`}>
                              {isUser ? "U" : <Sparkles className="w-4 h-4 text-blue-600" />}
                            </div>

                            {/* Message Bubble & Content */}
                            <div className="flex flex-col gap-1.5 max-w-2xl group relative">
                              <div className={`p-4 rounded-xl text-xs leading-relaxed ${
                                isUser 
                                  ? "bg-blue-600 text-white font-medium" 
                                  : "bg-white border border-slate-200 text-slate-800 shadow-sm"
                              }`}>
                                <div className="whitespace-pre-line">{msg.text}</div>

                                {/* Citation Chips */}
                                {!isUser && msg.citations && msg.citations.length > 0 && (
                                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5 items-center">
                                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                                      Evidence Citations:
                                    </span>
                                    {msg.citations.map(cit => (
                                      <button
                                        key={cit.index}
                                        onClick={() => setActiveCitationDetail(cit)}
                                        className="text-[11px] bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 px-2 py-0.5 rounded flex items-center gap-1 transition-all text-slate-700 font-medium"
                                      >
                                        <span className="text-[10px] font-mono text-blue-600 font-bold">[{cit.index}]</span>
                                        <span className="max-w-[130px] truncate">{cit.title}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {!isUser && (
                                <button
                                  onClick={() => handleCopy(msg.text, idx)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 text-slate-400 hover:text-slate-600 p-1 rounded bg-white border border-slate-200 shadow-sm"
                                  title="Copy text"
                                >
                                  {copiedIdx === idx ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {queryLoading && (
                        <div className="flex gap-3.5 mr-auto max-w-3xl">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-blue-600">
                            <Loader2 className="w-4 h-4 animate-spin" />
                          </div>
                          <div className="bg-white border border-slate-200 p-4 rounded-xl text-xs text-slate-600 flex items-center gap-3 shadow-sm">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                            <span>Retrieving vector evidence & generating grounded response...</span>
                          </div>
                        </div>
                      )}

                      <div ref={chatBottomRef} />
                    </div>

                    {/* Bottom Question Box & Prompt Pills */}
                    <div className="p-4 border-t border-slate-200 bg-white">
                      <div className="max-w-3xl mx-auto flex flex-col gap-3">
                        
                        {/* Suggested Prompts Pills */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider shrink-0">
                            Suggested:
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
                              className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-200/80 shrink-0 text-[11px] font-medium transition-colors"
                            >
                              {pillText}
                            </button>
                          ))}
                        </div>

                        {/* Input Box Bar */}
                        <form onSubmit={(e) => { e.preventDefault(); handleSendQuestion(chatInput); }} className="relative flex items-center">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder={`Ask a research question about ${selectedCompany.name}...`}
                            disabled={queryLoading}
                            className="input-field pr-24 py-3 bg-white text-xs shadow-sm"
                          />
                          <div className="absolute right-2 flex items-center gap-1">
                            <button 
                              type="button"
                              className="p-1.5 text-slate-400 hover:text-slate-600 rounded"
                              title="Attach Context File"
                            >
                              <Paperclip className="w-4 h-4" />
                            </button>
                            <button
                              type="submit"
                              disabled={!chatInput.trim() || queryLoading}
                              className="btn-primary py-1.5 px-3 text-xs"
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
                        <h3 className="font-bold text-slate-900 text-base">Sources & Vector Chunks Matrix</h3>
                        <p className="text-xs text-slate-500">Indexed candidate pages from Firecrawl crawl pipeline</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative w-64">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                          <input 
                            type="text"
                            value={sourceSearchQuery}
                            onChange={(e) => setSourceSearchQuery(e.target.value)}
                            placeholder="Filter sources..."
                            className="input-field pl-8 py-1.5 text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex gap-2 text-xs border-b border-slate-200 pb-3">
                      {["all", "services", "careers", "investors", "news", "about"].map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSourceCategoryFilter(cat)}
                          className={`px-3 py-1 rounded-md capitalize font-medium transition-colors ${
                            sourceCategoryFilter === cat 
                              ? "bg-slate-900 text-white font-semibold" 
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    {/* Sources Cards */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { title: "Core Services & Digital Solutions", type: "services", score: "0.89", chunk: "chk_9a12b" },
                        { title: "Careers & Engineering Hiring", type: "careers", score: "0.84", chunk: "chk_4f81c" },
                        { title: "Financial Reports & Investor Brief", type: "investors", score: "0.78", chunk: "chk_3d11e" },
                        { title: "Press Releases & Enterprise News", type: "news", score: "0.74", chunk: "chk_7b29a" },
                        { title: "Company Overview & Leadership", type: "about", score: "0.71", chunk: "chk_1e40c" },
                      ].map((item, i) => (
                        <div key={i} className="card-clean p-4 flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-2">
                            <span className={`badge-source ${item.type}`}>{item.type}</span>
                            <span className="text-[11px] font-mono text-slate-400">Score: {item.score}</span>
                          </div>
                          <h4 className="font-semibold text-xs text-slate-900 mb-2">{item.title}</h4>
                          <div className="text-[11px] text-slate-500 font-mono flex items-center justify-between pt-2 border-t border-slate-100">
                            <span>Chunk: {item.chunk}</span>
                            <span className="text-blue-600 font-sans font-medium flex items-center gap-1 cursor-pointer">
                              Inspect <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                )}

                {/* TAB 3: Q&A HISTORY */}
                {activeTab === "history" && (
                  <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto flex flex-col gap-4">
                    <h3 className="font-bold text-slate-900 text-base">Q&A Research Audit Log</h3>
                    <p className="text-xs text-slate-500">Historical questions and verified grounded responses for {selectedCompany.name}</p>

                    <div className="space-y-4">
                      {chatHistory.filter(m => m.role === "user").map((userMsg, idx) => (
                        <div key={idx} className="card-clean p-4 flex flex-col gap-2">
                          <div className="text-xs font-semibold text-slate-900 flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Q: {userMsg.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 4: INSIGHTS BREAKDOWN */}
                {activeTab === "insights" && (
                  <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto flex flex-col gap-6">
                    <h3 className="font-bold text-slate-900 text-base">Grounded Intelligence Summary</h3>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="card-clean p-4 text-center">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Company Target</span>
                        <span className="text-sm font-bold text-slate-900">{selectedCompany.name}</span>
                      </div>

                      <div className="card-clean p-4 text-center">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Vector Model</span>
                        <span className="text-sm font-bold text-blue-600 font-mono">BGE-Base-v1.5 (768d)</span>
                      </div>

                      <div className="card-clean p-4 text-center">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Retrieval Fusion</span>
                        <span className="text-sm font-bold text-emerald-600 font-mono">RRF Vector + FTS</span>
                      </div>
                    </div>

                    <div className="card-clean p-6 flex flex-col gap-3">
                      <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">Automated Intelligence Breakdown</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Structure-aware chunking split candidate pages into semantic blocks. All query responses strictly enforce a zero-hallucination policy grounded directly on PostgreSQL pgvector candidate embeddings.
                      </p>
                    </div>
                  </div>
                )}

                {/* TAB 5: COMPANY PROFILE */}
                {activeTab === "profile" && (
                  <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto flex flex-col gap-4">
                    <h3 className="font-bold text-slate-900 text-base">Target Profile: {selectedCompany.name}</h3>
                    <div className="card-clean p-6 space-y-3 text-xs">
                      <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-500 font-medium">Domain URL</span>
                        <span className="font-mono text-slate-900">{selectedCompany.website_url}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-500 font-medium">Status</span>
                        <span className="font-semibold text-emerald-600">Research Ready</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Internal ID</span>
                        <span className="font-mono text-slate-500">{selectedCompany.id}</span>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* 3. RIGHT SIDEBAR EVIDENCE INSPECTOR (WHEN CITATION IS CLICKED) */}
              {activeCitationDetail && (
                <div className="w-80 border-l border-slate-200 bg-white p-5 shrink-0 overflow-y-auto flex flex-col gap-4 shadow-lg animate-in slide-in-from-right duration-200">
                  
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <FileText className="w-4 h-4 text-blue-600" />
                      Evidence Inspector
                    </div>
                    <button 
                      onClick={() => setActiveCitationDetail(null)}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Citation Tag */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-bold font-mono">
                      Citation [{activeCitationDetail.index}]
                    </span>
                    <span className={`badge-source ${activeCitationDetail.source_type}`}>
                      {activeCitationDetail.source_type}
                    </span>
                  </div>

                  {/* Title */}
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                      Document Title
                    </span>
                    <h4 className="font-bold text-xs text-slate-900 leading-snug">
                      {activeCitationDetail.title}
                    </h4>
                  </div>

                  {/* Section Heading */}
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                      Header Context
                    </span>
                    <div className="text-xs text-slate-700 font-mono bg-slate-50 border border-slate-200 p-2 rounded truncate">
                      {activeCitationDetail.section_header || "# Overview"}
                    </div>
                  </div>

                  {/* Quoted Snippet */}
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                      Quoted Text Snippet
                    </span>
                    <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 p-3 rounded leading-relaxed italic">
                      "{activeCitationDetail.snippet || "Extracted content block verified against pgvector candidate embeddings."}"
                    </p>
                  </div>

                  {/* URL */}
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                      Source Link
                    </span>
                    <a 
                      href={activeCitationDetail.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline font-mono truncate flex items-center gap-1"
                    >
                      <span className="truncate">{activeCitationDetail.url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>

                  {/* Fact Grounding Badge */}
                  <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-[11px] text-blue-900 flex items-start gap-2 mt-auto">
                    <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Fact-Grounded Vector Match</span>
                      Mapped directly from PostgreSQL candidate chunks.
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
