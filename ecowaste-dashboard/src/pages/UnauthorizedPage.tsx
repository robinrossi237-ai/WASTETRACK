import { Link } from 'react-router-dom';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="card-solid w-full max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Unauthorized</h1>
        <p className="mt-2 text-sm text-slate-600">
          This web dashboard is for admins only. Collectors and residents should use the mobile app.
        </p>
        <div className="mt-6">
          <Link
            to="/login"
            className="btn btn-secondary"
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
