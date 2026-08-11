import Button from './components/Button.jsx';
import Navbar from './components/Navbar.jsx';
import Card from './components/Card.jsx';
import AboutCard from './components/AboutCard.jsx';

function App() {
  return (
    <div>
      <Navbar />
      <Card>
        <h2 className="text-2xl font-extrabold text-sky-500 text-center mb-[2rem]">Welcome to GH School Hub</h2>
        <p className="text-center text-gray-600 mb-8">Connect with students across Ghana.</p>
      </Card>
      <AboutCard>
        <h2 className="text-2xl font-extrabold text-sky-500 text-center mb-[2rem]">About GH School Hub</h2>
        <p className="text-center text-gray-600 mb-8">GH School Hub is a platform that connects students, teachers, and schools across Ghana. Our mission is to foster collaboration and communication within the educational community.</p>
      </AboutCard>
    </div>
  );
}

export default App;