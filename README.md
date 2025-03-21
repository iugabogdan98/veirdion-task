# veirdion-task

### API endpoints:

    GET /hello -> Greeting you back :D
    GET /scrape -> Scrapes the websites in the sample-websites.csv file and returns the titles of the websites

### Project config, dependencies and environment:

- Macbook Pro M1 Pro, 10 cores, 16GB RAM
- Node.js with Typescript | Express.js | Axios -> standard project config
- Cheerio -> parsing and manipulating HTML
- p-limit -> limit the number of concurrent promises

## Step 1:

First thing was to create the base of the project, add the middlewares to make it
simpler to work with and test all libs work as expected.

To start the Step 1 scraping process, firstly I tried a dummy solution to get
a starting reference point for and see how things improve over iterations.

In this dummy solution, I created an end **/scrape** endpoint that hits all the websites
in the **sample-websites.csv** file, parses and returns all the titles of all the website
with the success and fails count.

With initial config values :

- having HTTPS,
- 20 concurrent requests and 20 seconds timeout to read
- Headers to make the requests look like it originated from a browser

And the results are at almost **60% success rate in 1 minute 37 seconds**.

![](assets/Step_1_dummy_solution_get_titles.png)

But having the same config with HTTP instead of HTTPS, we jump to **70% success rate in 1m 45s**

![](assets/Step_1_dummy_not_secure_titles.png)

I will diff the two success lists to see if we lose possible hits by going with HTTP, or we need a mixture of these two.

##### Having all this validated, and with the dummy solution working, I can now start the real searching for the data needed for the scraping task. My main objectives for now are:

- Group the errors by their type, understand why they fail and find how I can reduce the fail rate.
- Group the successes into categories, find if they have the data I'm interested in
  ( phone numbers, social media links, address / location ) directly in the homepage.
- Check the robots.txt pages, see if I can find relevant information there
- Try to hit as many relevant pages as possible, decide on how to handle about-us/contact pages.
- See if locales are relevant to this set of websites, and if I need to handle them differently.
