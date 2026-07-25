export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="w-full max-w-2xl mx-auto px-5 py-5">
        <p className="text-xs text-slate-400 text-center">
          Built for{' '}
          <a
            href="https://digitalheroesco.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 hover:text-emerald-700 font-medium underline-offset-2 hover:underline"
          >
            Digital Heroes Training Task
          </a>
        </p>
      </div>
    </footer>
  );
}
