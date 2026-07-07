import { Link, useLocation } from 'react-router-dom';
import '../styles/Navbar.css';

export default function Navbar() {
  const location = useLocation();

  const links = [
    { path: '/', label: '查词', icon: '🔍' },
    { path: '/wordbook', label: '收藏本', icon: '📖' },
    { path: '/review', label: '每日复习', icon: '📝' },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-brand">英语单词本</div>
      <div className="navbar-links">
        {links.map(({ path, label, icon }) => (
          <Link
            key={path}
            to={path}
            className={`navbar-link ${location.pathname === path ? 'active' : ''}`}
          >
            <span className="nav-icon">{icon}</span>
            <span className="nav-label">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
