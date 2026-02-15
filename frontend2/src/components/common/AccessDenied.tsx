import { Link } from 'react-router-dom';

export function AccessDenied({
  title = '접근할 수 없습니다',
  description = '권한이 없거나 존재하지 않는 리소스입니다.',
  actionLabel = '대시보드로 이동',
  actionTo = '/dashboard',
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <div className="p-6 md:p-10">
      <div className="max-w-xl mx-auto glass-card rounded-2xl p-8 border border-white/10">
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-400">lock</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-white">{title}</h1>
            <p className="mt-2 text-sm text-gray-400 leading-relaxed">{description}</p>
            <div className="mt-6">
              <Link
                to={actionTo}
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white transition-colors"
              >
                {actionLabel}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

