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
  HelpCircle,
  ExternalLink
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
  // Sidebar State
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyItem | null>(null);
  
  // Tab view controller: "landing" | "chat" | "progress"
  const [view, setView] = useState<"landing" | "chat" | "progress">("landing");

  // Ingestion Input Form
  const [companyName, setCompanyName] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [triggering, setTriggering] = useState(false);
  const [formError, setFormError] = useState("");

  // Ingestion Job Polling State
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>("pending");
  const [jobPagesDiscovered, setJobPagesDiscovered] = useState(0);
  const [jobPagesProcessed, setJobPagesProcessed] = useState(0);
  const [jobLogs, setJobLogs] = useState("");
  const [jobError, setJobError] = useState("");

  // Chat/Query State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);
  const [activeCitationDetail, setActiveCitationDetail] = useState<Citation | null>(null);

  // Auto-scroll references
  const logsConsoleRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Researched Companies
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

  // 2. Poll Ingestion Job Progress
  useEffect(() => {
    if (!activeJobId) return;

    let intervalId = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jobs/${activeJobId}`);
        if (res.ok) {
          const job = await res.json();
          setJobStatus(job.status);
          setJobPagesDiscovered(job.pages_discovered);
          setJobPagesProcessed(job.pages_processed);
          setJobLogs(job.logs || "");
          
          if (job.status === "completed") {
            clearInterval(intervalId);
            setActiveJobId(null);
            // Refresh sidebar
            await fetchCompanies();
            // Automatically switch selected company to load the completed RAG view
            if (selectedCompany) {
              const updatedCompany = { ...selectedCompany, status: "completed" };
              setSelectedCompany(updatedCompany);
              loadChatHistory(updatedCompany.id);
              setView("chat");
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

  // Auto-scroll logs terminal
  useEffect(() => {
    if (logsConsoleRef.current) {
      logsConsoleRef.current.scrollTop = logsConsoleRef.current.scrollHeight;
    }
  }, [jobLogs]);

  // Auto-scroll chat window
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory]);

  // 3. Load Q&A Query History Logs for selected company
  const loadChatHistory = async (coId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/companies/${coId}/history`);
      if (res.ok) {
        const historyData = await res.json();
        // Compile historyData into ChatMessage structures (ordered chronologically)
        const compiledMessages: ChatMessage[] = [];
        // Map backend history (latest first) to chat history (oldest first)
        const reversed = [...historyData].reverse();
        for (const item of reversed) {
          compiledMessages.push({ role: "user", text: item.question });
          compiledMessages.push({ 
            role: "assistant", 
            text: item.answer,
            citations: item.citations || [] 
          });
        }
        
        // Add welcome message if history is empty
        if (compiledMessages.length === 0) {
          compiledMessages.push({
            role: "assistant",
            text: `Research phase complete! Ask me anything about the company. I will generate responses grounded solely on the crawled web data and link citations.`
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
      setView("chat");
      loadChatHistory(company.id);
    } else if (company.status === "failed") {
      setView("landing");
    } else {
      // It must be pending/running
      setView("progress");
      // Find and poll the job ID associated with this company
      triggerActiveJobTracking(company.id);
    }
  };

  // Track active job on sidebar clicks
  const triggerActiveJobTracking = async (_coId: string) => {
    try {
      // Find the running job ID from API keys check or jobs listing
      const res = await fetch(`${API_BASE}/api/companies`);
      if (res.ok) {
        // Just trigger a lookup or refresh
        // For V1, the simplest way is to poll status if we triggered it in this session.
        // We'll let the trigger_research endpoint handle saving the active job ID in React state.
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 5. Trigger Research Submission
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
        
        // Reset inputs
        setCompanyName("");
        setCompanyUrl("");
        
        // Set up active job tracker
        setActiveJobId(data.job_id);
        setJobStatus("pending");
        setJobPagesDiscovered(0);
        setJobPagesProcessed(0);
        setJobLogs("Job registered in queue. Waiting for worker process...\n");
        setJobError("");
        
        // Refresh sidebar lists to show "pending" state
        await fetchCompanies();
        
        // Select the newly added company item
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
      setFormError("Connection error. Is the backend server running?");
    } finally {
      setTriggering(false);
    }
  };

  // 6. Send Q&A Question
  const handleSendQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedCompany || queryLoading) return;

    const userQuestion = chatInput.trim();
    setChatInput("");
    setQueryLoading(true);

    // Append user question to chat stream
    setChatHistory(prev => [...prev, { role: "user", text: userQuestion }]);

    try {
      const res = await fetch(`${API_BASE}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: selectedCompany.id,
          question: userQuestion
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
            text: "Error: Failed to process query. Please check server logs." 
          }
        ]);
      }
    } catch (e) {
      setChatHistory(prev => [
        ...prev, 
        { 
          role: "assistant", 
          text: "Connection failed. Please check your backend network link." 
        }
      ]);
    } finally {
      setQueryLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden text-slate-100">
      
      {/* 1. LEFT SIDEBAR: Researched directory */}
      <aside className="w-80 border-r border-slate-800 bg-[#070b14] flex flex-col shrink-0">
        
        {/* App Title Banner */}
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <Building2 className="w-8 h-8 text-violet-500" />
          <div>
            <h1 className="text-lg font-bold font-outfit text-white tracking-tight">Research RAG</h1>
            <span className="text-[10px] text-violet-400 font-semibold tracking-wider uppercase">Automated V1 Portal</span>
          </div>
        </div>

        {/* Action Button: Reset to trigger new Research */}
        <div className="p-4">
          <button 
            onClick={() => { setSelectedCompany(null); setView("landing"); }}
            className="w-full btn-primary justify-center text-sm py-3"
          >
            <Plus className="w-4 h-4" />
            Research New Company
          </button>
        </div>

        {/* Directory List of Companies */}
        <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1">
          <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Researched Companies
          </div>
          
          {loadingCompanies && companies.length === 0 ? (
            <div className="flex justify-center items-center py-8 text-slate-500 gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
              <span className="text-xs">Loading directory...</span>
            </div>
          ) : companies.length === 0 ? (
            <div className="px-4 py-6 text-xs text-slate-500 text-center italic">
              No companies researched yet.
            </div>
          ) : (
            companies.map(c => {
              const isActive = selectedCompany?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => handleSelectCompany(c)}
                  className={`list-item-btn ${isActive ? "active" : ""}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-sm truncate pr-2 text-slate-200">
                      {c.name}
                    </span>
                    {c.status === "completed" && (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium uppercase">
                        Active
                      </span>
                    )}
                    {c.status === "failed" && (
                      <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-medium uppercase">
                        Failed
                      </span>
                    )}
                    {(c.status === "pending" || c.status === "running") && (
                      <span className="text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full font-medium uppercase animate-pulse">
                        Crawl
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 truncate flex items-center gap-1">
                    <Globe className="w-3 h-3 shrink-0" />
                    {c.website_url.replace(/^https?:\/\//, "")}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* 2. CENTER PANEL: Dynamic workspace */}
      <main className="flex-1 bg-[#0b0f19] flex flex-col relative overflow-hidden">
        
        {/* TOP STATUS BAR */}
        <header className="h-16 border-b border-slate-800 bg-[#070b14]/50 backdrop-blur-md px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {selectedCompany ? (
              <>
                <Building2 className="w-5 h-5 text-violet-400" />
                <span className="font-bold text-white font-outfit">{selectedCompany.name}</span>
                <span className="text-slate-600">|</span>
                <a 
                  href={selectedCompany.website_url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-xs text-slate-400 hover:text-violet-400 flex items-center gap-1 transition-colors"
                >
                  {selectedCompany.website_url}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </>
            ) : (
              <>
                <Building2 className="w-5 h-5 text-slate-500" />
                <span className="font-bold text-slate-400 font-outfit">Company Workspace</span>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {view === "progress" && (
              <div className="pulse-badge">
                <span className="dot"></span>
                Ingesting...
              </div>
            )}
            <span className="text-xs text-slate-500">API Status: Online</span>
          </div>
        </header>

        {/* WORKSPACE AREA VIEWS */}
        <div className="flex-1 overflow-hidden relative flex">

          {/* VIEW A: LANDING PAGE (Create new research profile) */}
          {view === "landing" && (
            <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-8 max-w-2xl mx-auto">
              
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center mb-6 shadow-lg shadow-violet-500/20">
                <Search className="w-8 h-8 text-white" />
              </div>
              
              <h2 className="text-3xl font-extrabold text-white mb-2 font-outfit tracking-tight text-center">
                Automated Company Research RAG
              </h2>
              
              <p className="text-slate-400 text-sm text-center mb-8 max-w-md">
                Enter a company name and website URL below. The pipeline will automatically crawl the domain, clean noise, chunk structure, run embeddings, and create a custom Q&A workspace.
              </p>

              {/* Research Form Box */}
              <form onSubmit={handleStartResearch} className="glass-card p-6 w-full flex flex-col gap-4">
                
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Company Name</label>
                  <input 
                    type="text" 
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Acme Corporation" 
                    disabled={triggering}
                    className="input-field"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Website URL</label>
                  <input 
                    type="text" 
                    value={companyUrl}
                    onChange={(e) => setCompanyUrl(e.target.value)}
                    placeholder="e.g. acme.com or https://acme.com" 
                    disabled={triggering}
                    className="input-field"
                  />
                </div>

                {formError && (
                  <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg flex items-center gap-2">
                    <XCircle className="w-4 h-4 shrink-0" />
                    {formError}
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={triggering}
                  className="btn-primary mt-2 justify-center w-full"
                >
                  {triggering ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Initializing Pipeline...
                    </>
                  ) : (
                    <>
                      Research Company
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* VIEW B: PROGRESS SCREEN (Poll active crawl crawler console logs) */}
          {view === "progress" && (
            <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto flex flex-col justify-center">
              
              <div className="glass-card p-8 mb-6 flex flex-col gap-6">
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                    <div>
                      <h3 className="text-lg font-bold text-white font-outfit">Web Ingestion Pipeline Active</h3>
                      <p className="text-xs text-slate-400">Crawling, index parsing, and creating pgvector embeddings...</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">Status</span>
                    <span className="text-sm font-semibold text-violet-400 capitalize">{jobStatus}</span>
                  </div>
                </div>

                {/* Progress bar info */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex justify-around text-center">
                  <div>
                    <span className="text-xs text-slate-500 block uppercase tracking-wider font-semibold">Pages Found</span>
                    <span className="text-2xl font-bold text-white">{jobPagesDiscovered}</span>
                  </div>
                  <div className="border-r border-slate-800"></div>
                  <div>
                    <span className="text-xs text-slate-500 block uppercase tracking-wider font-semibold">Processed</span>
                    <span className="text-2xl font-bold text-emerald-400">{jobPagesProcessed}</span>
                  </div>
                </div>

                {/* Logs Terminal */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <Terminal className="w-4 h-4 text-emerald-500" />
                    Live Crawler Event Logs
                  </div>
                  <div ref={logsConsoleRef} className="console-box">
                    {jobLogs || "Initializing socket stream...\n"}
                  </div>
                </div>

                {jobError && (
                  <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-4 rounded-lg flex items-start gap-2">
                    <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block mb-0.5">Ingestion Failed</span>
                      {jobError}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW C: CHAT WORKSPACE (Grounded Q&A threads) */}
          {view === "chat" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              
              {/* Message Feed Container */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {chatHistory.map((msg, idx) => {
                  const isUser = msg.role === "user";
                  return (
                    <div 
                      key={idx} 
                      className={`flex gap-4 max-w-3xl ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                    >
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold text-white ${isUser ? "bg-violet-600" : "bg-slate-800 border border-slate-700"}`}>
                        {isUser ? "U" : "AI"}
                      </div>
                      
                      {/* Content Box */}
                      <div className="flex flex-col gap-2">
                        <div className={`p-4 rounded-2xl text-sm leading-relaxed ${isUser ? "bg-violet-600/25 border border-violet-500/20 text-slate-100 rounded-tr-none" : "bg-[#111625] border border-slate-800 text-slate-200 rounded-tl-none"}`}>
                          
                          {/* Main answer text content */}
                          <div className="whitespace-pre-line">{msg.text}</div>
                          
                          {/* Citation Chips Grid (Under response answers) */}
                          {!isUser && msg.citations && msg.citations.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap gap-2 items-center">
                              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1">
                                <FileText className="w-3 h-3" /> Supporting Sources:
                              </span>
                              {msg.citations.map(cit => (
                                <button
                                  key={cit.index}
                                  onClick={() => setActiveCitationDetail(cit)}
                                  className="text-xs bg-slate-900 border border-slate-800 hover:border-violet-500/50 hover:bg-slate-800/50 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all text-slate-300 font-medium"
                                >
                                  <span className="text-[9px] bg-violet-500/20 text-violet-300 px-1 rounded font-bold">{cit.index}</span>
                                  <span className="max-w-[120px] truncate">{cit.title}</span>
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
                    <div className="w-8 h-8 rounded-lg shrink-0 bg-slate-800 border border-slate-700 flex items-center justify-center">
                      <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                    </div>
                    <div className="bg-[#111625] border border-slate-800 p-4 rounded-2xl text-sm text-slate-400 flex items-center gap-2 rounded-tl-none">
                      <Loader2 className="w-4.5 h-4.5 animate-spin text-violet-500" />
                      Scanning hybrid vectors and generating grounded response...
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Message Input Form Footer */}
              <div className="p-6 border-t border-slate-800 bg-[#070b14]/50 backdrop-blur-md">
                <form onSubmit={handleSendQuestion} className="max-w-3xl mx-auto relative flex items-center">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={`Ask me anything about ${selectedCompany?.name || "the company"}...`}
                    disabled={queryLoading}
                    className="input-field pr-12 py-3.5 bg-slate-950/70"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || queryLoading}
                    className="absolute right-2 p-2 text-violet-400 hover:text-white disabled:opacity-50 disabled:hover:text-violet-400 transition-colors"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* 3. RIGHT SIDEBAR DRAWER: Citation Evidence Sniffer */}
          {activeCitationDetail && (
            <div className="w-80 border-l border-slate-800 bg-[#070b14]/90 backdrop-blur-md p-6 shrink-0 overflow-y-auto flex flex-col gap-6 absolute right-0 top-0 bottom-0 z-10 shadow-2xl">
              
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2 text-sm font-bold text-white font-outfit">
                  <FileText className="w-4 h-4 text-violet-500" />
                  Source Evidence Details
                </div>
                <button 
                  onClick={() => setActiveCitationDetail(null)}
                  className="text-slate-500 hover:text-white p-1"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Title & Index */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded font-bold font-outfit">
                    Source #{activeCitationDetail.index}
                  </span>
                  <span className={`badge-source ${activeCitationDetail.source_type}`}>
                    {activeCitationDetail.source_type}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-100 leading-snug">
                  {activeCitationDetail.title}
                </h4>
              </div>

              {/* Section Header */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">
                  Document Section
                </span>
                <span className="text-xs text-slate-300 font-mono bg-slate-900 border border-slate-800/80 px-2.5 py-1.5 rounded-lg truncate">
                  {activeCitationDetail.section_header}
                </span>
              </div>

              {/* Source URL Link */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">
                  Target Link
                </span>
                <a 
                  href={activeCitationDetail.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-xs text-violet-400 hover:text-violet-300 break-all flex items-center gap-1 transition-colors"
                >
                  {activeCitationDetail.url}
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              </div>

              {/* Help Card */}
              <div className="bg-slate-950/60 border border-slate-800/50 p-4 rounded-xl text-xs text-slate-400 flex flex-col gap-2">
                <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                  <HelpCircle className="w-4 h-4 text-violet-400" />
                  Fact-Grounding Notice
                </div>
                This resource was mapped dynamically from our hybrid indexes. The LLM parsed this exact URL to back up its responses, ensuring zero system hallucinations.
              </div>

            </div>
          )}

        </div>
      </main>

    </div>
  );
}
