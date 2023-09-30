// main.js
import create_api from './sprot.js';

const api_options = {
  //httpOptions: { /* your HTTP options here */ },
};

const app = create_api(api_options);

app.use((req, res, next) => {
  // Middleware logic here
  next(); // Call next to proceed to the next middleware or route
});

app.get('/', (req, res) => {
  // Handle GET request for the root path '/'
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello, World!');

});
/*
app.get('/user', (req, res) => {
  // Handle GET request for '/user'
});*/

app.on('error', (error, req, res, next) => {
  // Handle errors here
  res.writeHead(500, { 'Content-Type': 'text/plain' });

  console.error("interna server error")
  next(error)
});

export function run_server() {
  
  //will not compile
  app.start((error) => {
    if (error) {
      console.log(error);
    } else {
      console.log("App is running");
    }
  });
  /*
  app.start(() => {
    console.log("App is running");
  });*/
}