import Navbar from './components/Navbar.jsx';
import Card from './components/Card.jsx';

function App() {
  return (
    <div className="min-h-screen bg-slate-50/50 pb-16">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 sm:mt-12 space-y-8">
        {/* Main Hero Card */}
        <Card className="w-full text-center bg-gradient-to-b from-sky-50/50 to-white border-sky-200/60 py-12 sm:py-16">
          <span className="text-xs sm:text-sm font-semibold tracking-widest text-sky-600 uppercase mb-3 block">
            Welcome to the Community
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-800 tracking-tight leading-tight mb-4">
            Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-blue-600">GH School Hub</span>
          </h1>
          <p className="text-slate-600 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Connecting students, educators, and schools across Ghana on a single, unified platform.
          </p>
        </Card>

        {/* Side-by-Side Responsive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {/* About Section */}
          <Card className="h-full">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight mb-4 flex items-center gap-2">
                <span className="text-sky-500">📍</span> About Us
              </h2>
              <p className="text-slate-600 text-base leading-relaxed">
                GH School Hub connects students, teachers, and schools across Ghana. Our mission is to foster collaboration, ease communication, and empower the educational community with modern tools.
              </p>
            </div>
          </Card>

          {/* Features Section */}
          <Card className="h-full">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight mb-6 flex items-center gap-2 text-center">
                <span className="text-sky-500">✨</span> Platform Features
              </h2>
              <ul className="space-y-3">
                {[
                  "Student and teacher profiles",
                  "Comprehensive school directories",
                  "Event announcements & updates",
                  "Interactive discussion forums",
                  "Real-time student feeds"
                ].map((feature, idx) => (
                  <li key={idx} className="flex items-center text-slate-600 font-medium gap-3">
                    <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0"></span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default App;