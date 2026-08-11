// Card.jsx
// A reusable container for displaying different types of content.
// The content placed between <Card> and </Card>
// becomes available through the "children" prop.

function Card({ children }) {
  return (
    <div className="rounded-2xl border border-sky-200 mt-[2rem] ml-[2rem] p-[5rem] shadow-sm h-[35rem] w-[60rem] flex flex-col justify-center items-center">
      {children} 
    </div>
  );
}

export default Card;