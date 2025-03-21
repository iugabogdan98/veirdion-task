import express from 'express';
import {router} from "./routes/router";
import {errorWrapper} from "./error-wrapper";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use('', router);
app.use(errorWrapper);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});