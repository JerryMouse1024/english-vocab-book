import { Link, useLocation } from 'react-router-dom';
import { Search, BookOpen, CalendarCheck } from 'lucide-react';
import '../styles/Navbar.css';

export default function Navbar() {
  const location = useLocation();

  const links = [
    { path: '/', label: '查词', Icon: Search },
    { path: '/wordbook', label: '收藏本', Icon: BookOpen },
    { path: '/review', label: '每日复习', Icon: CalendarCheck },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-links">
        {links.map(({ path, label, Icon }) => (
          <Link
            key={path}
            to={path}
            className={`navbar-link ${location.pathname === path ? 'active' : ''}`}
            title={label}
          >
            <Icon className="nav-icon" size={22} strokeWidth={1.8} />
            <span className="nav-label">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
