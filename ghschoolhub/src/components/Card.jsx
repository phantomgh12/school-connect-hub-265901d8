// Reusable card container with modern glass/border styling and responsive padding
function Card({ children, className = "" }) {
  return (
    <div className={`rounded-3xl border border-sky-100 bg-white p-6 sm:p-10 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col justify-between ${className}`}>
      {children}
    </div>
  );
}

export default Card;