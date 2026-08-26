(function loadRobiAlphabet(global) {
  "use strict";

  const entries = [
    ["A", "Algoritmo", "Pasos en orden para hacer una tarea."],
    ["B", "Botón", "Parte que se presiona para dar una orden."],
    ["C", "Código", "Órdenes que una computadora puede seguir."],
    ["D", "Dato", "Información que se puede guardar y usar."],
    ["E", "Equipo", "Personas que trabajan juntas."],
    ["F", "Función", "Tarea que debe hacer una parte del programa."],
    ["G", "Gráfico", "Dibujo que ayuda a entender datos."],
    ["H", "Hardware", "Partes de la computadora que se pueden tocar."],
    ["I", "Internet", "Red que conecta computadoras de todo el mundo."],
    ["J", "Juego", "Actividad con reglas para aprender y divertirse."],
    ["K", "Kilobyte", "Medida pequeña para archivos digitales."],
    ["L", "Lenguaje", "Palabras y reglas para poder comunicarse."],
    ["M", "Memoria", "Lugar donde la computadora guarda datos."],
    ["N", "Navegador", "Programa para visitar páginas web."],
    ["Ñ", "Ñandú", "Ave grande que corre muy rápido."],
    ["O", "Orden", "Forma de acomodar bien las cosas."],
    ["P", "Programa", "Órdenes que hacen trabajar a una computadora."],
    ["Q", "Quipu", "Cuerdas con nudos para guardar información."],
    ["R", "Robot", "Máquina que sigue instrucciones."],
    ["S", "Sensor", "Parte que detecta luz, sonido o movimiento."],
    ["T", "Tecnología", "Ideas y herramientas para resolver problemas."],
    ["U", "Usuario", "Persona que usa un programa o aparato."],
    ["V", "Video", "Imágenes en movimiento que pueden tener sonido."],
    ["W", "Web", "Grupo de páginas que se visitan en Internet."],
    ["X", "Xilófono", "Instrumento musical con láminas de colores."],
    ["Y", "Yoyó", "Juguete que sube y baja por una cuerda."],
    ["Z", "Zumbido", "Sonido largo, como el de una abeja."]
  ];

  const imageNames = [
    "a-algoritmo", "b-boton", "c-codigo", "d-dato", "e-equipo",
    "f-funcion", "g-grafico", "h-hardware", "i-internet", "j-juego",
    "k-kilobyte", "l-lenguaje", "m-memoria", "n-navegador", "enie-niandu",
    "o-orden", "p-programa", "q-quipu", "r-robot", "s-sensor",
    "t-tecnologia", "u-usuario", "v-video", "w-web", "x-xilofono",
    "y-yoyo", "z-zumbido"
  ];

  global.ROBI_ALPHABET = Object.freeze(entries.map(([letter, word, meaning], index) => ({
    id: `A${String(index + 1).padStart(2, "0")}`,
    kind: "alphabet",
    category: "Abecedario",
    letter,
    word,
    meaning,
    imageUrl: `./images/alphabet/${imageNames[index]}.png`
  })));
})(globalThis);
