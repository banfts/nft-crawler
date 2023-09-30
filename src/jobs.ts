import { agenda } from './queue.js'
/*
create interfaces for the jobs + crawler
interface CreateContact extends JobAttributesData {
  contactDetails: Contact // app-specific type
}*/

agenda.define/*<CreateContact>*/('CRAWL_SUPPLY_BLOCK', async (job/*: Job<CreateContact>*/) => {
  const { data } = job.attrs.data;
  // crawling goes here
  // you call them like this OUTSIDE the define of course
  // agenda.now("CRAWL_SUPPLY_BLOCK", { supply_hash: '' });
})

/*
// constructorevts
agenda.on("start", (job) => {
  console.log("Job %s starting", job.attrs.name);
});

// complete - called when a job finishes, regardless of if it succeeds or fails
// complete:job name - called when a job finishes, regardless of if it succeeds or fails
agenda.on("complete", (job) => {
  console.log(`Job ${job.attrs.name} finished`);
});

//success - called when a job finishes successfully
//success:job name - called when a job finishes successfully
agenda.on("success:send email", (job) => {
  console.log(`Sent Email Successfully to ${job.attrs.data.to}`);
});

//fail - called when a job throws an error
//fail:job name - called when a job throws an error
agenda.on("fail:send email", (err, job) => {
  console.log(`Job failed with error: ${err.message}`);
});

job failed
job.fail("insufficient disk space");

async way
agenda.define("some long running job", async (job) => {
  const data = await doSomelengthyTask();
  await formatThatData(data);
  await sendThatData(data);
});

agenda.define(
  "send email report",
  { priority: "high", concurrency: 10 },
  async (job) => {
    const { to } = job.attrs.data;
    await emailClient.send({
      to,
      from: "example@example.com",
      subject: "Email Report",
      body: "...",
    });
  }
);

agenda.now<CreateContact>('CREATE CONTACT', {
  contactDetails: {...} // required attr
})

agenda.schedule<CreateContact>('in 5 minutes', 'CREATE CONTACT', {
  contactDetails: {...} // required attr
})
*/