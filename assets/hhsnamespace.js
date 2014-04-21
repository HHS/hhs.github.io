/// hhsnamespace
///
/// Copyright 2013 Kitware Inc.
/// Apache 2.0 License
///
///

window.HHSGlobal = (function () {

  var that = {};

  var listOfRepos = [];
  var listOfMembers = [];
  var listOfOrgsReposReceived = [];
  var listOfOrgsMembersReceived = [];
  var listOfOrgsRequested = [];

  that.processReposCallback = function() {};
  that.processMembersCallback = function() {};

  that.namespace = function(ns_string) {

    /// Written after example from "JavaScript Patterns", pages 89-90.

    var parts = ns_string.split('.'),
        parent = HHSGlobal,
        i;

    // strip redundant leading global
    if (parts[0] === “HHSGlobal" ) {
      parts = parts.slice(1);
      }

    for (i = 0; i < parts.length; i += 1) {
      // create a property if it doesn't exist
      if (typeof parent[parts[i]] === "undefined") {
        parent[parts[i]] = {};
        }
      // insert the property in a nested pattern
      parent = parent[parts[i]];
      }

    return parent;

    };

  that.initializeCache = function() {

    HHSGlobal.namespace('cache.orgs');
    HHSGlobal.namespace('cache.repos');
    HHSGlobal.namespace('cache.reposDate');
    HHSGlobal.namespace('cache.members');
    HHSGlobal.namespace('cache.membersDate');

    };

  that.getJSONIfModifiedWithCORS = function(uri,sinceDate,successFunction) {

    function clientSideUpdate() {

        if (xhr.readyState === 4) {

          var result = {};

          if (xhr.status===200) {
            result.data = JSON.parse(xhr.responseText);
            }

          result.status = xhr.status;
          result.lastModified = xhr.getResponseHeader('Last-Modified');

          console.log('X-RateLimit-Remaining: ' + xhr.getResponseHeader('X-RateLimit-Remaining'));

          successFunction(result);
          }

        }

    var xhr = new XMLHttpRequest();

    xhr.open('get',uri,true);

    xhr.onreadystatechange = clientSideUpdate;

    if (sinceDate) {
      xhr.setRequestHeader('If-Modified-Since',sinceDate);
      }

    xhr.send(null);

    };

  that.getJSONIfModified = that.getJSONIfModifiedWithCORS;

  that.getCachedRepositories = function() {
    var cachedRepos = window.localStorage.getItem('HHSrepos');
    if (cachedRepos) {
      HHSGlobal.cache.repos = JSON.parse(cachedRepos);
      var repos = HHSGlobal.cache.repos;
      return repos;
      }
    return null;
    };

  that.getCachedMembers = function() {
    var cachedMembers = window.localStorage.getItem('HHSmembers');
    if (cachedMembers) {
      HHSGlobal.cache.members = JSON.parse(cachedMembers);
      var members = HHSGlobal.cache.members;
      return members;
      }
    return null;
    };

  that.getLastReposChangeDateInCache = function(org,page) {

    var lastModifiedDate = null;

    if (window.localStorage) {

      var localStorageDates = window.localStorage.getItem('HHSReposDate');

      if ( localStorageDates !== "undefined" && localStorageDates !== null) {
        HHSGlobal.cache.reposDate = JSON.parse( localStorageDates );
        var orgDates = HHSGlobal.cache.reposDate[org];
        if (orgDates) {
          lastModifiedDate = orgDates[page];
          }
        }
      }

    return lastModifiedDate;

    };

  that.storeLastReposChangeDateInCache = function(org,page,lastModifiedDate) {

    HHSGlobal.namespace('cache.reposDate.'+org);
    HHSGlobal.namespace('cache.reposDate.'+org+'.'+page);

    HHSGlobal.cache.reposDate[org][page] = lastModifiedDate;

    if (window.localStorage) {
      window.localStorage.setItem('HHSReposDate', JSON.stringify( HHSGlobal.cache.reposDate ) );
      }

    };

  that.reportReceivedOrgRepos = function(org) {

        listOfOrgsReposReceived.push(org);

    };

  that.reportReceivedOrgMembers = function(org) {

      listOfOrgsMembersReceived.push(org);

    };

  that.accumulateListOfMembers = function(data) {

      listOfMembers = listOfMembers.concat(data);

    };

  that.accumulateListOfRepos = function(data) {

    listOfRepos = listOfRepos.concat(data);

    };

  that.haveReceivedAllRequestedOrgRepos = function(org) {

    return ( listOfOrgsReposReceived.length === listOfOrgsRequested.length );

    };

  that.haveReceivedAllRequestedOrgMembers = function(org) {

    return ( listOfOrgsMembersReceived.length === listOfOrgsRequested.length );

    };

  that.processMembers = function() {

    HHSGlobal.processMembersCallback(listOfMembers);

    };

  that.processRepos = function() {

    HHSGlobal.processReposCallback(listOfRepos);

    };

  that.getReposFromOneOrg = function(org,page) {

        page = page || 1;

        var uri = "https://api.github.com/orgs/" + org + "/repos?"
                + "&access_token=b200f47521b2b51309a8baf7f3e5e2fdb73ab69a"
                + "&per_page=100"
                + "&page="+page;

        var lastModifiedDate = HHSGlobal.getLastReposChangeDateInCache(org,page);


        HHSGlobal.getJSONIfModified(uri,lastModifiedDate, function (result) {

          if ( result.status === 403 ) { // Refused

            console.log('STATUS 403: Server refused. This typically means a saturation of the rate limit');

            HHSGlobal.reportReceivedOrgRepos(org);

            listOfRepos = HHSGlobal.getCachedRepositories();

            if( HHSGlobal.haveReceivedAllRequestedOrgRepos() ) {
              HHSGlobal.processRepos();
              }

            }

          if ( result.status === 304 ) { // Not Modified

            HHSGlobal.reportReceivedOrgRepos(org);

            listOfRepos = HHSGlobal.getCachedRepositories();

            if( HHSGlobal.haveReceivedAllRequestedOrgRepos() ) {
              HHSGlobal.processRepos();
              }

            }

          if ( result.status === 200 ) { // OK Status

            if (result.data && result.data.length > 0) {
              // Concatenate with previous pages
              HHSGlobal.accumulateListOfRepos(result.data);
              HHSGlobal.storeLastReposChangeDateInCache(org,page,result.lastModified);
              // Go on recursively
              HHSGlobal.getReposFromOneOrg(org, page + 1);
              }
            else {
              // Completed paginating the repos
              HHSGlobal.reportReceivedOrgRepos(org);

              if( HHSGlobal.haveReceivedAllRequestedOrgRepos() ) {
                HHSGlobal.storeReposInCache();
                HHSGlobal.processRepos();
                }
              }

            }

        });
      };

  that.populateListOfRequestOrgs = function() {

      var setOfOrgs = JSON.parse( HHSGlobal.cache.orgs );

      listOfOrgsRequested = [];

      for (var org in setOfOrgs) {
        listOfOrgsRequested.push(org);
        }
    };

  that.clearListOfReceivedReposOrgs = function() {

      listOfOrgsReposReceived = [];

      }

  that.clearListOfReceivedMembersOrgs = function() {

      listOfOrgsMembersReceived = [];

      }

  that.getReposFromAllOrgs = function() {

      HHSGlobal.populateListOfRequestOrgs();
      HHSGlobal.clearListOfReceivedReposOrgs();

      var setOfOrgs = JSON.parse( HHSGlobal.cache.orgs );

      for (var org in setOfOrgs) {
        HHSGlobal.getReposFromOneOrg(org);
        }

    };

  that.storeMembersInCache = function() {

    if (listOfMembers) {
      HHSGlobal.cache.members = JSON.stringify(listOfMembers);
      window.localStorage.setItem('HHSmembers',HHSGlobal.cache.members);
      }

    };

  that.storeReposInCache = function() {

    if (listOfRepos) {
      HHSGlobal.cache.repos = JSON.stringify(listOfRepos);
      window.localStorage.setItem('HHSrepos',HHSGlobal.cache.repos);
      }

    };

  that.findAllOrgsFromReposCatalog = function(reposCatalog) {

      var setOfOrgs = {};

      for (var i = 0; i < reposCatalog.length; i++) {
        var repoEntry = reposCatalog[i];
        if ( repoEntry ) {
          var fullName = repoEntry.full_name;
          if ( fullName ) {
            var pieces = fullName.split("/");
            var orgName = pieces[0].toLowerCase();
            setOfOrgs[orgName] = true;
            }
          }
        }

      HHSGlobal.cache.orgs = JSON.stringify(setOfOrgs);

    };

  that.storeLastMembersChangeDateInCache = function(org,lastModifiedDate) {

      HHSGlobal.cache.membersDate[org] = lastModifiedDate;

      if (window.localStorage) {
        window.localStorage.setItem('HHSMembersDate',JSON.stringify(HHSGlobal.cache.membersDate ) );
        }

    };

  that.getLastMembersChangeDateInCache = function(org) {

      var lastModifiedDate = null;

      if (window.localStorage) {

        var localStorageDates = window.localStorage.getItem('HHSMembersDate');

        if ( localStorageDates !== "undefined" && localStorageDates !== null) {
          HHSGlobal.cache.membersDate = JSON.parse( localStorageDates );
          lastModifiedDate = HHSGlobal.cache.membersDate[org];
          }
        }

    return lastModifiedDate;

    };

  that.getMembersFromAllOrgs = function() {

      HHSGlobal.populateListOfRequestOrgs();
      HHSGlobal.clearListOfReceivedMembersOrgs();

      var setOfOrgs = JSON.parse( HHSGlobal.cache.orgs );

      for (var org in setOfOrgs) {
        HHSGlobal.getMembersFromOneOrg(org);
        }

    };


  that.getMembersFromOneOrg = function (org) {

      var uri = 'https://api.github.com/orgs/' + org + '/members?'
                + "&access_token=b200f47521b2b51309a8baf7f3e5e2fdb73ab69a";

      var lastMemberDateChange = HHSGlobal.getLastMembersChangeDateInCache(org);

      HHSGlobal.getJSONIfModified(uri, lastMemberDateChange, function (result) {

        HHSGlobal.reportReceivedOrgMembers(org);

        if ( result.status === 403 ) { // Refused

          listOfMembers = HHSGlobal.getCachedMembers();

          if( HHSGlobal.haveReceivedAllRequestedOrgMembers() ) {
            HHSGlobal.processMembers();
            }

          }

        if ( result.status === 304 ) { // Not Modified

          listOfMembers = HHSGlobal.getCachedMembers();

          if( HHSGlobal.haveReceivedAllRequestedOrgMembers() ) {
            HHSGlobal.processMembers();
            }

          }

        if ( result.status === 200 ) { // OK Status

          HHSGlobal.accumulateListOfMembers(result.data);

          if( HHSGlobal.haveReceivedAllRequestedOrgMembers() ) {
            HHSGlobal.storeLastMembersChangeDateInCache(org,result.lastModified);
            HHSGlobal.storeMembersInCache();
            HHSGlobal.processMembers();
            }

          }

        });

      };

  that.urlQueryString = function(key) {

        var vars = [], hash;
        var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');

        for(var i = 0; i < hashes.length; i++) {
            hash = hashes[i].split('=');
            vars.push(hash[0]);
            vars[hash[0]] = hash[1];
          }

        return vars[key];

      };

  that.addRecentlyUpdatedRepo = function(repo) {

        if (repo) {
          var $item = $("<li>");

          var $name = $("<a>").attr("href", repo.html_url).text(repo.name);
          $item.append($("<span>").addClass("name").append($name));

          var formattedDate;
          if (browserIsIELessThan10) {
            formattedDate = repo.pushed_at;
            }
          else {
            formattedDate = strftime("%h %e, %Y", repo.pushed_at);
            }

          var $time = $("<a>").attr("href", repo.html_url + "/commits").text(formattedDate);
          $item.append($("<span>").addClass("time").append($time));

          $item.append('<span class="bullet">&sdot;</span>');

          var $watchers = $("<a>").attr("href", repo.html_url + "/watchers").text(repo.watchers + " stargazers");
          $item.append($("<span>").addClass("watchers").append($watchers));

          $item.append('<span class="bullet">&sdot;</span>');

          var $forks = $("<a>").attr("href", repo.html_url + "/network").text(repo.forks + " forks");
          $item.append($("<span>").addClass("forks").append($forks));

          $item.appendTo("#recently-updated-repos");
          }
      };

    that.addRecentlyUpdatedRepos = function(repos) {

          $(function () {

            if( repos ) {

              $("#num-repos").text(repos.length);

              // Convert pushed_at to Date.
              $.each(repos, function (i, repo) {
                if (!browserIsIELessThan10) {
                  repo.pushed_at = new Date(repo.pushed_at);
                  }
              });

              // Sort by most-recently pushed to.
              repos.sort(function (a, b) {
                if (a.pushed_at < b.pushed_at) return 1;
                if (b.pushed_at < a.pushed_at) return -1;
                return 0;
              });

              $.each(repos.slice(0, 3), function (i, repo) {
                HHSGlobal.addRecentlyUpdatedRepo(repo);
              });
            }

          });

        };


    that.getMembersFromOneOrgWithoutCORS = function(org) {

        var uri = "https://api.github.com/orgs/" + org + "/members?"
                + "&callback=?"
                + "&access_token=b200f47521b2b51309a8baf7f3e5e2fdb73ab69a";

        $.getJSON(uri, function (result) {

          HHSGlobal.reportReceivedOrgMembers(org);
          HHSGlobal.accumulateListOfMembers(result.data);

          if( HHSGlobal.haveReceivedAllRequestedOrgMembers() ) {
            HHSGlobal.storeMembersInCache();
            HHSGlobal.processMembers();
            }

        });

      };

  that.getReposFromOneOrgWithoutCORS = function(org,page) {

        page = page || 1;

        var uri = "https://api.github.com/orgs/" + org + "/repos?"
                + "&callback=?"
                + "&per_page=100"
                + "&page="+page
                + "&access_token=b200f47521b2b51309a8baf7f3e5e2fdb73ab69a";

        $.getJSON(uri, function (result) {

          if (result.data && result.data.length > 0) {
            HHSGlobal.accumulateListOfRepos(result.data);
            HHSGlobal.storeLastReposChangeDateInCache(org,page,result.lastModified);
            HHSGlobal.getReposFromOneOrgWithoutCORS(org,page + 1);
            }
          else {
            // Completed paginating the repos
            HHSGlobal.reportReceivedOrgRepos(org);

            if( HHSGlobal.haveReceivedAllRequestedOrgRepos() ) {
              HHSGlobal.storeReposInCache();
              HHSGlobal.processRepos();
              }
            }

        });
      };


  return that;

}());
