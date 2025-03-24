# veirdion-task

### API endpoints:

    GET /hello -> Greeting you back :D
    
    GET /scrape -> Scrapes the websites in the sample-websites.csv file and returns the titles of the websites
    
    GET /search -> Searches the scraped data for the given query, returns the results
    query params: - name, website, phoneNumber, facebook -> strings

### Project config, dependencies and environment:

- Macbook Pro M1 Pro, 10 cores, 16GB RAM
- Node.js (v20.9.0) with Typescript | Express.js | Axios -> standard project config
- Cheerio -> parsing and manipulating HTML
- p-limit -> limit the number of concurrent promises
- minisearch -> search engine for the data ( in-mem alternative in node for ElasticSearch )

## Step 1:

First thing was to create the base of the project, add the middlewares to make it
simpler to work with and test all libs work as expected.

To start the Step 1 scraping process, firstly I tried a dummy solution to get
a starting reference point and see how things improve over iterations.

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

Given that I won't do any operations that require sensitive data, I will keep the HTTP version.
![](assets/http_security.png)

##### Having all this validated, and with the dummy solution working, I can now start the real searching for the data needed for the scraping task. My main objectives for now are:

- Group the errors by their type in <ins>failed_requests_log.txt</ins>, understand why they fail and find how I can
  reduce
  the fail rate.
- Look at tge successes, find if they have the data I'm interested in
  ( phone numbers, social media links, address / location ) directly in the homepage.
- Try to hit as many relevant pages as possible, decide on how to handle about-us/contact pages.
- See if locales are relevant to this set of websites, and if I need to handle them differently.

##### Grouping Errors we have:

- getaddrinfo ENOTFOUND: 187 errors
    - This is a DNS resolution error, the domain is not found. I tried to change my DNS to google/cloudfare's but to no
      results.
- ERR_BAD_REQUEST: 64 errors of 404's, not much to do here, the website is not found.
- ECONNABORTED: 11 errors, i might increase the timeout a little, maybe we can hit a few of these
- Security & certificate issues : around 10 errors
- Rest of errors: Around 20 are caused by me, I hit the server one too many times and got blocked.
  I will change my network to see if I can bypass it and raise a bit the hit rate. An alternative would be a list of
  proxy or a VPN that would alternate between runs, but in this case it doesn't seem to be worth it.

### Parsing the data

Here comes the interesting part, parsing the data to get the data I'm interested in.
I think we need to start with initial assumptions and see how we can build upon it :

- Firstly, the footer usually has the contact info we're interested in, so we already have a good starting point
- Secondly, the contact page is the place where these informations have to be, so we can target it directly after
  parsing the landing page
- Thirdly, if a contact page is missing, maybe there is an about-us page that has the info we need

Now, a simple approach to finding the contact page is to use the landing page, that we already have parsed
and find a hyperlink to that page, trying to match variations of the word **contact** in the href using a simple Regex.

An alternative approach is to use the sitemap.xml, a similar approach, but it requires extra calls and is not guraatned
to exist,
given we win by not parsing the landing page and just the sitemap we lose by complexity. Maybe use it later as
a fallback.

Of course, the main issues now is that not all the websites are in english, and not all are localized.
We can start with just words in english, the results are :
![](assets/Step1_get_Contact_Page.png)

Managed to get 228 contact pages, keeping the success rate at 70%, but slashing the time to 1 minute, 4 s.

I did that by optimizing the concurrent requests to be **3 x number of CPU's ( 24 in my case )**,
and closing other thread hungry processes. Any more, and it starts to throttle the requests.

##### Next, I will decide on the phone number, social media and address Regex.

I want to hit the landing page and the contact page with them, maximizing the chances of getting the data.

- Phone number: I will use a simple regex that matches the most common phone number formats : up to 13 digits, ( 1
  special chars, with variations of groups between 2 and 4 chars) with optional spaces, dashes, brackets and the country
  code.

![](assets/Step1_get_Contact_Page.png)

Optimization:
Some pages use JS frameworks and while we fetch them they don't have the content available it's the JS is loaded.
We will use Puppeteer exatcly for these cases. One example fo page where we managed to get the phone number
using puppeteer is: "http://timent.com"

With all this in place, I managed to scrape **312 pages** for phone number ( with a fair amount of noise and false
positives ), but mainly phone numbers.

##### Social media

A little bit simpler, as we can create a regex to match the root of usual social media websites, and they
generally have links pointing to them. I will still crawl the contact and about us pages, as I already have access to
them and they are the most likely to have the links.

#### Later update: I found a bug ( I used the landing url when trying to find the contact page) and now my success phoneNumbers jumped to 457 websites

![](assets/Task1_fixed_bug.png)

##### Address

It's optional, but while I'm still at it, I can use a generic regex to catch a few of them.
Nothing too specific, going for the standard format of an address, with a few variations.

While it's more restrictive, I managed to get 140+ addresses, with a few false positives.

We have a total of :
![](assets/Task1_final_results.png)

##### While requests are fluctuating because of timeout/denials, we get consistently round 696 websites, giving us a success rate of almost 70% in well under 2 minutes.

Out of these 696 websites, we managed to get relative to this number of websites:

- Around 450 with at one phone number, around 65% fill rate. A lot of noise here, but a lot of data too.
- Around 370 social media links, around 53%. Much less noise, as the Regex is more targeted here.
- Around 150 addresses, around 22%. The most restrictive and centered around the USA, but still a good amount of data.

With a full fill example of :

        {
            "success": true,
            "url": "http://dolee-rentals.com",
            "phoneNumbers": "229) 436-9620,229) 344-5037",
            "socialMediaLinks": "https://facebook.com/DoLee-Rentals-Inc-141860142549724,https://twitter.com/DexYPHQ/,https://twitter.com/",
            "addresses": "1001 W Oglethorpe Blvd, Albany, GA 31701",
            "errorCode": ""
        },

While this first iteration is ok, there are some things I can improve on:

- More usage of Puppeteer when needed, I just covered an edge case, but there are more.
- Regex might not the best solution, as it's not a case of 'one size fits all'. I can manipulate more the
  HTML and integrate more tags for contact info. Go after targeted classes, ids, etc.
- I tried to catch in my regexes international cases too, but I think a more targeted approach based on the locales is
  better.
- Reduce the noise

#### Optimizations:

I target to stay under 2 mins from the start, and I managed to achive that. With smarter DOM manipulation and
better regexes, I can reduce the time even more. Using pLimit helped a lot, and the only bottleneck
is the time to get some websites ( up to 20 seconds or more ).

I will save both the failed req and successful ones in the output folder, for future reference.

## Step 2:

Now that I have the data, I will save it in output/successful_scrapes.csv to have it saved as a base
for the search service.
Now everytime we start the service, it will parse the data from both csv files and merge them into a single
searchable JSON array of company details.

The dataset is small enough to use in-memory solutions, as opposed starting an ElastricSearch instance.
I will use minisearch, a simple but complete solution that I can fine tune to search the data by trial and error.
In a large data set, I would use ElasticSearch, as it's more robust and scalable,
but in this case it feels like trying to hit kill a fly with a bazooka. Cool in theory, but expensive.

The boosts in my search are:

- domain name: the most important, as it's a unique identifier ( got to 4 )
- company all names, second most important, as it's really leading to a good result ( got to 3)
- phone number, facebook : given the noise, I will boost just them a little, half of the company name.

Not much else, keep it a bit fuzzy, use combineWith OR to have felixiblity in the search.

The results are satisfying, I will publish them (testing the api with the recomended input) in the root of the project
in the file **API_RESULTS.pdf**

Results :

- 108 requests: all the data independent and the request with all the data combined.
- 12 red -> returned other result rather what was expected
- 10 orange -> fuzzy data, put in there to show the flexibility of the search
- 86 green -> returned the expected result !!! :D

#### STEP 3:

Measuring the accuracy of your matches. More ways to go here:

- A good source of truth would be a great, gatherer over time by validated data by hand and/or algorithms or available
  and structured data on the web
- Try different algos, different approaches, and see how they fare, even better to validate them with the source of
  truth.
- Throw in some noise, see how it changes the match values and fine tune the search.
- try to find the edge cases, where an website or phone number differes by a few chars, and see how the search
  handles them.
- doing the math, see how the percentages evolve iteration over iteration.

### Closing thoughts

As a first iterations of a scraper, I'm happy with the results.
It gave me manny chanllenges, and I learned a lot from them.
While there are things to improve, tools I cloud use, in this short amount of time,
the scale, the data gathered, the complexity and the results are satisfying.

Cheers! :D


