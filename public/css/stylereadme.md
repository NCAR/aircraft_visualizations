# Styled using tailwind for the grid
 For deployment add @import "tailwindcss"; to style.css
To compile the new css file, run 
`npx @tailwindcss/cli -i ./public/style.css -o public/css/output.css --watch` 
which will output a new css file with the correct tailwind components based on the main style.css.