let express = require("express");
const buildService = require("../services/build-service");
const projectService = require("../services/project-service");
const caseService = require("../services/case-service");
const ignoringService = require("../services/ignoring-service");
const { authenticateJWT } = require("../utils/auth-utils");

let router = express.Router();

const allCasesPassed = allCases => {
    let eachCase;
    let allCasesPassed = true;

    for (eachCase of allCases) {
        if (eachCase.caseResult !== "passed") {
            allCasesPassed = false;
            break;
        }
    }

    return allCasesPassed;
};

router.get("/:bid", authenticateJWT, function(req, res, next) {
    (async () => {
        try {
            const build = await buildService.getBuildByBid(req.params.bid);
            const project = await projectService.getProjectByPid(build.pid);
            const cases = await caseService.getBuildCases(build.bid);

            const isAllPassed = allCasesPassed(cases);
            const ableToRebase = !build.isBaseline && isAllPassed;

            res.render("build-standalone", {
                isAllPassed,
                pid: build.pid,
                bid: build.bid,
                isBaseline: build.isBaseline,
                projectName: project.projectName,
                buildIndex: build.buildIndex,
                allCases: cases,
                ableToRebase: ableToRebase,
                hostUrl: `http://${req.get("host")}`,
            });
        } catch (error) {
            console.error(error);
            next(error);
        }
    })();
});

router.post("/rebase/:bid", authenticateJWT, function(req, res, next) {
    (async () => {
        try {
            const build = await buildService.getBuildByBid(req.params.bid);
            const project = await projectService.getProjectByPid(build.pid);
            await ignoringService.cleanProjectIgnoring(build.pid);

            await buildService.rebase(project.projectName, req.params.bid);
            res.redirect(`/build/${req.params.bid}`);
            console.log(`rebased build, bid=${req.params.bid}`);
        } catch (error) {
            console.error(error);
            next(error);
        }
    })();
});

router.post("/debase/:bid", authenticateJWT, function(req, res, next) {
    (async () => {
        try {
            const build = await buildService.getBuildByBid(req.params.bid);
            const project = await projectService.getProjectByPid(build.pid);
            await ignoringService.cleanProjectIgnoring(build.pid);

            await buildService.debase(project, build);
            res.redirect(`/build/${req.params.bid}`);
            console.log(`debased build, bid=${req.params.bid}`);
        } catch (error) {
            console.error(error);
            next(error);
        }
    })();
});

router.post("/pass/:bid", authenticateJWT, function(req, res, next) {
    (async () => {
        try {
            const build = await buildService.getBuildByBid(req.params.bid);
            const cases = await caseService.getBuildCases(build.bid);

            for (const item of cases) {
                await caseService.passCase(item.cid);

                await caseService.cleanComprehensiveCaseResult(item.cid);
                await caseService.checkAndUpdateBuildResult(item.cid);
            }

            res.redirect(`/build/${req.params.bid}`);
            console.log(`pass build, bid=${req.params.bid}`);
        } catch (error) {
            console.error(error);
            next(error);
        }
    })();
});

module.exports = router;
