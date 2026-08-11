import { useState, useEffect } from 'react';
import Button from './Button.jsx';

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  // Prevent background scrolling when mobile drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <>
      <nav className="bg-gradient-to-r from-sky-500 to-sky-600 px-4 sm:px-8 py-4 text-white flex justify-between items-center shadow-md sticky top-0 z-40">
        {/* Brand / Logo */}
        <a href="#" className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
          <span>🎓</span> GH School Hub
        </a>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-8 font-medium text-sky-50">
          <a href="#about" className="hover:text-white transition-colors">About</a>
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#directory" className="hover:text-white transition-colors">Directory</a>
        </div>

        {/* Desktop Buttons */}
        <div className="hidden md:flex gap-3">
          <Button text="Get Started" variant="primary" />
          <Button text="Log In" variant="secondary" />
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={toggleMenu}
          aria-label="Toggle Navigation Menu"
          className="md:hidden p-2 rounded-lg text-white hover:bg-sky-600/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-colors"
        >
          {isOpen ? (
            /* Close Icon (X) */
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            /* Hamburger Icon */
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile Backdrop Overlay */}
      <div
        onClick={toggleMenu}
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 md:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Mobile Drawer Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-4/5 max-w-sm bg-white z-50 md:hidden shadow-2xl flex flex-col justify-between p-6 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div>
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <span className="text-lg font-black text-slate-800 flex items-center gap-2">
              <span>🎓</span> GH School Hub
            </span>
            <button
              onClick={toggleMenu}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Drawer Navigation Links */}
          <nav className="flex flex-col gap-4 mt-6">
            <a
              href="#about"
              onClick={toggleMenu}
              className="text-base font-semibold text-slate-700 hover:text-sky-600 p-2 rounded-lg hover:bg-sky-50 transition-colors"
            >
              About
            </a>
            <a
              href="#features"
              onClick={toggleMenu}
              className="text-base font-semibold text-slate-700 hover:text-sky-600 p-2 rounded-lg hover:bg-sky-50 transition-colors"
            >
              Features
            </a>
            <a
              href="#directory"
              onClick={toggleMenu}
              className="text-base font-semibold text-slate-700 hover:text-sky-600 p-2 rounded-lg hover:bg-sky-50 transition-colors"
            >
              Directory
            </a>
          </nav>
        </div>

        {/* Drawer Footer Buttons */}
        <div className="flex flex-col gap-3 pt-6 border-t border-slate-100">
          <Button text="Get Started" variant="primary" />
          <Button text="Log In" variant="secondary" />
        </div>
      </div>
    </>
  );
}

export default Navbar;