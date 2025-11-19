import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
} from "react-router-dom";
import Upload from "../pages/Upload";
import Search from "../pages/Search";

function AppShell() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col text-slate-900">
        <nav className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/90 backdrop-blur-md shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex flex-col sm:flex-row gap-4 sm:gap-6 items-center justify-between">
            <div className="flex flex-col items-center sm:items-start">
              <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">
                URL Intelligence Suite
              </p>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                URL Fetch & Search
              </h1>
            </div>
            <div className="flex gap-2 sm:gap-3 text-sm font-semibold">
              {[
                { to: "/upload", label: "Upload" },
                { to: "/search", label: "Search" },
              ].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      "px-4 sm:px-5 py-2 rounded-full transition-all duration-200",
                      "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 hover:bg-slate-50",
                      isActive
                        ? "bg-white text-slate-900 border-slate-900 shadow-[0_12px_30px_rgba(15,23,42,0.15)]"
                        : "",
                    ].join(" ")
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>

        <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-10 space-y-8">
          <Routes>
            <Route path="/" element={<Upload />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/search" element={<Search />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default AppShell;

