import { Agenda, Job, JobAttributesData } from 'agenda';
//const { Job, JobAttributesData } = Agenda;
//import Agenda, { Job, JobAttributesData } from 'agenda'

const connectionOpts = {  
  db: { 
    address: process.env.MONGODB_URI,
    collection: "jobs",
    defaultConcurrency: 2,
  },
};
export const agenda = new Agenda(connectionOpts);

const jobTypes = process.env.JOB_TYPES ? process.env.JOB_TYPES.split(",") : [];

jobTypes.forEach((type) => {
  // env JOB_TYPES=video-processing,image-processing node worker.js
  //import("./jobs/" + type)(agenda);
  // figure this out later 
});

if (jobTypes.length) {
  agenda.start(); // Returns a promise, which should be handled appropriately
}

