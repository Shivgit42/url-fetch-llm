interface ErrorBannerProps {
  message: string;
}

function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div className="p-4 rounded-2xl font-medium bg-rose-50 text-rose-800 border border-rose-200 shadow-sm">
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
        {message}
      </div>
    </div>
  );
}

export default ErrorBanner;

