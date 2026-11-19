# Prompts Ved gave Claude Code while building this

Verbatim, in order, from the Claude Code session transcript (16–19 Nov 2026). Two of the plan messages were dictated. Attached screenshots (Beep Job Hub UI, GitHub commit list) are not reproduced. The production LLM prompt is in `lib/llm/prompt.ts` and in `docs/SUBMISSION.md` §5.

## 1. 17 Nov 2026 01:06 IST

> Hi Ved,
> 
> Congratulations, you've been shortlisted for the next round at Beep for the Gen AI & Engineering role. We got more than 3,500 applications, and we read yours.
> 
> Beep is a career platform for college students in India. We have 1M+ users and were on Shark Tank India. We work hard, move fast and use AI for almost everything, so the next round is a real piece of work and not another form.
> 
> Your task
> 
> 1. Build it. Make a live web tool that collects 200+ real fresher job or internship posts in India from public sources (respect each site's terms), removes duplicates, uses an LLM to tag each post by role and city, and shows them on a searchable page that refreshes every day on its own.
> 
> 2. Explain it. In your video, walk us through the architecture, what broke and how you fixed it. Share the repo.
> 
> 3. Put a number on it. Hand-check 50 posts and tell us how accurate your tagging is, and what it costs you per 1,000 posts.
> 
> Submit here (this is your personal link): https://app.youform.com/forms/zp9defmm?aid=19302602&track=en
> You'll need a link to what you made, a max 5 min Loom (face + screen) explaining it, and a working doc or sheet with your data, the AI tools and the prompts you used.
> 
> Deadline: Friday, 20 November, 11:59 PM.
> 
> What happens next
> 1. We go through every submission ourselves.
> 2. The best ones get a 30 minute call with me. On that call I'll ask you to change your work live.
> 3. Final round at our office in Baner, Pune.
> 
> Use any AI tool you want. But the thinking has to be yours.
> 
> If you applied for more than one role and want a different task, just reply to this email.
> 
> Regards,
> Saurabh Mangrulkar
> Founder, Beep
> 
> 
>     take this as context only

## 2. 17 Nov 2026 01:10 IST

> Here is my plan. Let me know what do you think of this. So my plan is pretty straightforward. We will build up on Next.js serverless application. It will have two dedicated points, one for admin and one for student. Maybe we can have login, but like let's just not think of login as of now. So this is just MVP. So how I'm thinking of it is that we will use some popular platforms, whatever their terms and conditions are. We will look into that, but generally like green jobs and Ash jobs, Ashley jobs, these kind of platforms to provide their public APIs. We just need to get the company board token and use that to fetch via company directly, right? So what I'm thinking is a public front end where anyone can see all the jobs available. Specifically in this task, I guess we need to have like only those jobs which are freshers and internships, so we have to think of that as well. Okay, so my plan is pretty simple. We will use these APIs directly, respecting their terms and condition. We will have our admin page where we can add or delete the board token or duplicate board token as well, and check jobs there as well. And if there is any wrong job that is being scraped, which is not a fresher job and all, we have an option to delete that as well. So how the backend is going to work, my plan is this. We will first scrape and fetch all the jobs. Then we will build up a filtering system. I guess a hybrid filtering system is much better, regex plus LLM based. And I know like this is not going to be 100% right, but we can try using regex and LLM. And second thing is that we will save these jobs in our platform, our database. I'm thinking of using Neon DB for it, and we should have a cron job as well. Versal don't provide a cron job for their free plan. If we can just have a quick endpoint URL, and I can use some platform that uses a cron job that triggers it every like 15 minutes or and all. So the cron jobs keep running. So whenever that cron job runs, it checks for the new jobs and check if there is any new job and post it to our database and delete any old opening which is closed now or which is already being filled, like which we are not able to fetch from the website. And yeah, this is my plan. You can add your details as well and do a deep research as well. So if my intuition is right, what I'm thinking looks like a good idea.

## 3. 17 Nov 2026 01:21 IST

> Okay, it looks good. My plan, I had some a plan update. Uh, We can have a GitHub action directly for our cron job while we think of ourselves even. And second thing, what I'm thinking is Haiku is a good thing. We can have a set of JSON like sending like 10, 20 requests, 20 job posts in a batch, and then get the LLM evaluate that as well. Or we can have a vector of it or something like that as well. Rest looks good. Exuna is also interesting. I need to check how exactly it works. I don't actually know Exuna how it works. And we can set up the cron to like 6 hours a day, maybe every 6 hours. And yeah, soft close idea is good. Hybrid filter is what I'm already thinking. And yeah, like this is an MVP, so a minimal admin auth and a user spacing. And LLM, we can go with I guess, Gemini as well. I mean, Gemini has a free tier as well, but like, yeah, we have to find actual pricing. So I guess Haiku can be a good idea as well. Like, and what other things we can try? For LLM model, I guess we can even try Azure OpenAI. I mean, I don't know like how we can actually find the cost. Like we can, but right now I only have access of a Claude API. I do have a paid plan of it, so I can use that credits, or I can use Gemini. Like Gemini do give their API for free, but like most of its model are not free. So Haiku can be a good choice, but we don't know like until we try. But I am probably thinking like using regex based filter plus LLM. Like regex is already going to do half or like more than half of our work. So yeah, and in admin page, what I'm thinking is to have option to add board token as well. So admin can add or remove board token, and it should have a dedicated section like whenever someone put any board token, it should first check if this token is right or not. So we don't just start spamming board tokens without even knowing like if this is right or not. And second thing is we don't have really any login system, but I would still like to have this in UI that is being stored in the user local server, like whatever is going to open the website. Like where as soon as he clicks on the apply button, and it should directly be redirected to the job link. And when you come back to the website, it should have did you apply the yes or no like checkbox, and the apply button should be apply externally, like because it's not on our platform, so we are just redirecting it to the actual job post. And I guess yeah, this is what I'm thinking. Create a dedicated plan.nd or something like that, so we can start actually building it. Uh, The tech stack will be Next.js serverless. For serverless, we don't need to build any dedicated backend. Neon for database, and GitHub Action for our cron job, and probably like Claude, Haiku, Claude API for LLM.'

## 4. 17 Nov 2026 01:31 IST

> looks good but yeah let's not focus much on adzuna i saw it needs a dedicated account with card info let's work on this only i have added a design.md as well for design style i want the UI looks like actual job platform for now you can hardcode things like studen name and all just make sure there is UI or you can use the exact [Image #2] this UI official UI of beep

## 5. 17 Nov 2026 01:59 IST

> what took you soo much time also don't try local sqldb when we have neon if needed open claude in chrome andsetup a small project for this specific if it's not accesible cause of vercerl permission

## 6. 17 Nov 2026 16:10 IST

> just added anthropic api key in env can you keep pushing the code to github as well between don't put your name therer okay

## 7. 17 Nov 2026 16:11 IST

> github repo i have already connected so chill

## 8. 17 Nov 2026 16:42 IST

> can you do ti yourself ? also a deployed link is needed right i can post directly from the vercel putting env from here right also what went wrong with the jgh secret set ? i can do it manually if needed

## 9. 17 Nov 2026 16:48 IST

> i can put the exact env as it's give in vercel if needed or what you suggest me here ?

## 10. 17 Nov 2026 16:51 IST

> naah i will do via .env just give me the env that i need to add there plus a github secret what i need to put there also we showing amount for all the calls we need to find avg for 50 calls right ? add one thing for that in admin stats plus the UI someplace is overflowed check that as well use claude in chrome and test it to understand those microplaces and let's work on it as well

## 11. 17 Nov 2026 17:01 IST

> added secrets but why you using my different account huh ? [Image #3]

## 12. 17 Nov 2026 17:20 IST

> did deployement ever passed ?

## 13. 17 Nov 2026 17:23 IST

> let's see give it agian

## 14. 18 Nov 2026 11:30 IST

> we ready to make a video of it ? can you explain me things properly which page shows wha

## 15. 18 Nov 2026 19:04 IST

> what should i say with every screen tell me that

## 16. 19 Nov 2026 23:00 IST

> what is the wokring doc they asked for can you create that with the prompts we used in this chat ? /export
