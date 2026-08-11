// Navbar.jsx
// The Navbar contains the main navigation for GH School Hub.
// Keeping it separate from App.jsx makes it reusable.
import Button from './Button.jsx';

function Navbar() {
  return (
    <nav className="bg-sky-400 p-4 text-white flex justify-between items-center">
      <h2 className="text-2xl font-extrabold">GH School Hub</h2>

      <div>
        <Button text="Get Started" variant="primary" />
        <Button text="Log In" variant="secondary" />
      </div>
    </nav>
  );
}

export default Navbar;