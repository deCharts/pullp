/* eslint-disable import/no-named-as-default, no-console */

import React from 'react';
import { get } from 'lodash';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import { ApolloClient } from 'apollo-client';
import {
  InMemoryCache,
  IntrospectionFragmentMatcher,
} from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';
import { onError } from 'apollo-link-error';
import { ApolloLink } from 'apollo-link';
import { ApolloProvider } from 'react-apollo';
import { setContext } from 'apollo-link-context';
import { withClientState } from 'apollo-link-state';
import { persistCache } from 'apollo-cache-persist';
import { Provider } from 'react-redux';

import introspectionQueryResultData from '../../apollo/githubFragmentTypes.json';
import store from '../../store';
import LayoutContainer from '../LayoutNew';
import ScrollToTop from '../ScrollToTop';
import '../../css/index.css';

export default class App extends React.Component {
  state = {
    client: null,
    loaded: false,
  };

  async componentDidMount() {
    // We need to inform Apollo about the Github API's possible grapql fragment types
    // See https://www.apollographql.com/docs/react/advanced/fragments.html for more info
    const fragmentMatcher = new IntrospectionFragmentMatcher({
      introspectionQueryResultData: introspectionQueryResultData.data,
    });

    const apolloCache = new InMemoryCache({ fragmentMatcher });

    const stateLink = withClientState({
      cache: apolloCache,
      resolvers: {
        // Mutation: {
        //   updateGithubToken: (_, { token }, { cache }) => {
        //     const data = {
        //       githubAuth: {
        //         __typename: 'GithubAuth',
        //         token,
        //       },
        //     };
        //     cache.writeData({ data });
        //     return null;
        //   },
        // },
      },
      defaults: {
        githubAuth: {
          __typename: 'GithubAuth',
          token: null,
          loadingToken: false,
          error: null,
        },
      },
    });

    const authLink = setContext((_, previousContext) => {
      // get the authentication token from the cache
      const token = get(
        previousContext,
        'cache.data.data["$ROOT_QUERY.githubAuth"].token',
      );

      // return the headers to the context so httpLink can read them
      return {
        headers: {
          ...previousContext.headers,
          authorization: token ? `Bearer ${token}` : '',
        },
      };
    });

    const client = new ApolloClient({
      link: ApolloLink.from([
        onError(({ graphQLErrors, networkError }) => {
          if (graphQLErrors)
            graphQLErrors.map(({ message, locations, path }) =>
              console.log(
                `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`,
              ),
            );
          if (networkError) console.log(`[Network error]: ${networkError}`);
        }),
        stateLink,
        authLink,
        new HttpLink({
          uri: process.env.REACT_APP_GITHUB_API_URL,
          credentials: 'same-origin',
        }),
      ]),
      cache: apolloCache,
    });

    try {
      // Restore apollo cache from localstorage before allowing app to render
      await persistCache({
        cache: apolloCache,
        storage: window.localStorage,
        debug: true,
      });
    } catch (error) {
      console.error('Error restoring Apollo cache', error);
    }

    // eslint-disable-next-line react/no-did-mount-set-state
    this.setState({
      client,
      loaded: true,
    });
  }

  render() {
    const { client, loaded } = this.state;

    if (!loaded) {
      return <div>Loading...</div>;
    }

    return (
      <ApolloProvider client={client}>
        <Provider store={store}>
          <Router>
            <ScrollToTop>
              <Route path="*" component={LayoutContainer} />
            </ScrollToTop>
          </Router>
        </Provider>
      </ApolloProvider>
    );
  }
}