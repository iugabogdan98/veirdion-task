import express from 'express';
import {router} from "./routes/router";
import {errorWrapper} from "./utils/error-wrapper";
import {getMergedInputData} from "./utils/merge-input-data";
import {initializeSearch} from "./services/search";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use('', router);
app.use(errorWrapper);

async function startServer() {
    initializeSearch(await getMergedInputData());

    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});