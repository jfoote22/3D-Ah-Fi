export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-900/50 border-t-blue-500 rounded-full animate-spin mb-4 mx-auto"></div>
        <p className="text-blue-400 font-medium">Loading...</p>
        <p className="text-slate-500 text-sm mt-2">Preparing login page</p>
      </div>
    </div>
  );
} 