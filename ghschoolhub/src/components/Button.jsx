// Button.jsx
// This is a reusable button component.
// Instead of creating the same button repeatedly,
// we can use <Button /> anywhere in our application.

function Button({text, variant}) {
  return (
    <button className={`${variant === "primary" ? "bg-sky-500 text-white mr-2" : "bg-gray-500 text-white"} hover:bg-blue-700 font-bold py-2 px-4 rounded`}>
      {text}
    </button>
  );
}

export default Button;