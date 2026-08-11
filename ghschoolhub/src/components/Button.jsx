function Button({ text, variant = "primary" }) {
  const baseStyles = "font-semibold py-2 px-5 rounded-xl transition-all duration-200 text-sm sm:text-base shadow-sm active:scale-95";
  const variants = {
    primary: "bg-white text-sky-600 hover:bg-sky-50 hover:shadow-md",
    secondary: "bg-sky-500/20 text-white border border-white/30 hover:bg-sky-500/40"
  };

  return (
    <button className={`${baseStyles} ${variants[variant] || variants.primary}`}>
      {text}
    </button>
  );
}

export default Button;