function FeaturesCard({ children }) {
  return (
    <div className="rounded-2xl border border-sky-200 mt-[2rem] ml-[2rem] p-[5rem] shadow-sm h-[35rem] w-[25rem] flex flex-col justify-center items-center">
      {children} 
    </div>
  );
}

export default FeaturesCard;