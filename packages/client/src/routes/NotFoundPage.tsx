import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="py-24 text-center">
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p className="text-slate-500 mb-4">페이지를 찾을 수 없어요</p>
      <Link to="/" className="text-accent hover:underline">대시보드로 돌아가기</Link>
    </div>
  );
}
