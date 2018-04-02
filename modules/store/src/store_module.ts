import {
  NgModule,
  Inject,
  ModuleWithProviders,
  OnDestroy,
  InjectionToken,
  Injector,
} from '@angular/core';
import {
  Action,
  ActionReducer,
  ActionReducerMap,
  StoreFeature,
  InitialState,
  MetaReducer,
  StoreConfig,
} from './models';
import { combineReducers, createReducerFactory, isPlainObject } from './utils';
import {
  INITIAL_STATE,
  INITIAL_REDUCERS,
  _INITIAL_REDUCERS,
  REDUCER_FACTORY,
  _REDUCER_FACTORY,
  STORE_FEATURES,
  _INITIAL_STATE,
  META_REDUCERS,
  _STORE_REDUCERS,
  FEATURE_REDUCERS,
  _FEATURE_REDUCERS,
  _FEATURE_REDUCERS_TOKEN,
  ACTION_SERIALIZER,
} from './tokens';
import { ACTIONS_SUBJECT_PROVIDERS, ActionsSubject } from './actions_subject';
import {
  REDUCER_MANAGER_PROVIDERS,
  ReducerManager,
  ReducerObservable,
} from './reducer_manager';
import {
  SCANNED_ACTIONS_SUBJECT_PROVIDERS,
  ScannedActionsSubject,
} from './scanned_actions_subject';
import { STATE_PROVIDERS } from './state';
import { STORE_PROVIDERS, Store } from './store';

@NgModule({})
export class StoreRootModule {
  constructor(
    actions$: ActionsSubject,
    reducer$: ReducerObservable,
    scannedActions$: ScannedActionsSubject,
    store: Store<any>
  ) {}
}

@NgModule({})
export class StoreFeatureModule implements OnDestroy {
  constructor(
    @Inject(STORE_FEATURES) private features: StoreFeature<any, any>[],
    @Inject(FEATURE_REDUCERS) private featureReducers: ActionReducerMap<any>[],
    private reducerManager: ReducerManager,
    root: StoreRootModule
  ) {
    features
      .map((feature, index) => {
        const featureReducerCollection = featureReducers.shift();
        const reducers = featureReducerCollection /*TODO(#823)*/![index];

        return {
          ...feature,
          reducers,
          initialState: _initialStateFactory(feature.initialState),
        };
      })
      .forEach(feature => reducerManager.addFeature(feature));
  }

  ngOnDestroy() {
    this.features.forEach(feature =>
      this.reducerManager.removeFeature(feature)
    );
  }
}

@NgModule({})
export class StoreModule {
  static forRoot<T, V extends Action = Action>(
    reducers: ActionReducerMap<T, V> | InjectionToken<ActionReducerMap<T, V>>,
    config?: StoreConfig<T, V>
  ): ModuleWithProviders;
  static forRoot(
    reducers:
      | ActionReducerMap<any, any>
      | InjectionToken<ActionReducerMap<any, any>>,
    config: StoreConfig<any, any> = {}
  ): ModuleWithProviders {
    return {
      ngModule: StoreRootModule,
      providers: [
        { provide: _INITIAL_STATE, useValue: config.initialState },
        {
          provide: INITIAL_STATE,
          useFactory: _initialStateFactory,
          deps: [_INITIAL_STATE],
        },
        { provide: _INITIAL_REDUCERS, useValue: reducers },
        {
          provide: _STORE_REDUCERS,
          useExisting:
            reducers instanceof InjectionToken ? reducers : _INITIAL_REDUCERS,
        },
        {
          provide: INITIAL_REDUCERS,
          deps: [Injector, _INITIAL_REDUCERS, [new Inject(_STORE_REDUCERS)]],
          useFactory: _createStoreReducers,
        },
        {
          provide: META_REDUCERS,
          useValue: config.metaReducers ? config.metaReducers : [],
        },
        {
          provide: _REDUCER_FACTORY,
          useValue: config.reducerFactory
            ? config.reducerFactory
            : combineReducers,
        },
        {
          provide: REDUCER_FACTORY,
          deps: [_REDUCER_FACTORY, META_REDUCERS],
          useFactory: createReducerFactory,
        },
        {
          provide: ACTION_SERIALIZER,
          useValue: _createSerializer(config),
        },
        ACTIONS_SUBJECT_PROVIDERS,
        REDUCER_MANAGER_PROVIDERS,
        SCANNED_ACTIONS_SUBJECT_PROVIDERS,
        STATE_PROVIDERS,
        STORE_PROVIDERS,
      ],
    };
  }

  static forFeature<T, V extends Action = Action>(
    featureName: string,
    reducers: ActionReducerMap<T, V> | InjectionToken<ActionReducerMap<T, V>>,
    config?: StoreConfig<T, V>
  ): ModuleWithProviders;
  static forFeature<T, V extends Action = Action>(
    featureName: string,
    reducer: ActionReducer<T, V> | InjectionToken<ActionReducer<T, V>>,
    config?: StoreConfig<T, V>
  ): ModuleWithProviders;
  static forFeature(
    featureName: string,
    reducers:
      | ActionReducerMap<any, any>
      | InjectionToken<ActionReducerMap<any, any>>
      | ActionReducer<any, any>
      | InjectionToken<ActionReducer<any, any>>,
    config: StoreConfig<any, any> = {}
  ): ModuleWithProviders {
    return {
      ngModule: StoreFeatureModule,
      providers: [
        {
          provide: STORE_FEATURES,
          multi: true,
          useValue: <StoreFeature<any, any>>{
            key: featureName,
            reducerFactory: config.reducerFactory
              ? config.reducerFactory
              : combineReducers,
            metaReducers: config.metaReducers ? config.metaReducers : [],
            initialState: config.initialState,
          },
        },
        { provide: _FEATURE_REDUCERS, multi: true, useValue: reducers },
        {
          provide: _FEATURE_REDUCERS_TOKEN,
          multi: true,
          useExisting:
            reducers instanceof InjectionToken ? reducers : _FEATURE_REDUCERS,
        },
        {
          provide: FEATURE_REDUCERS,
          multi: true,
          deps: [
            Injector,
            _FEATURE_REDUCERS,
            [new Inject(_FEATURE_REDUCERS_TOKEN)],
          ],
          useFactory: _createFeatureReducers,
        },
      ],
    };
  }
}

export function _createStoreReducers(
  injector: Injector,
  reducers: ActionReducerMap<any, any>,
  tokenReducers: ActionReducerMap<any, any>
) {
  return reducers instanceof InjectionToken ? injector.get(reducers) : reducers;
}

export function _createFeatureReducers(
  injector: Injector,
  reducerCollection: ActionReducerMap<any, any>[],
  tokenReducerCollection: ActionReducerMap<any, any>[]
) {
  const reducers = reducerCollection.map((reducer, index) => {
    return reducer instanceof InjectionToken ? injector.get(reducer) : reducer;
  });

  return reducers;
}

export function _initialStateFactory(initialState: any): any {
  if (typeof initialState === 'function') {
    return initialState();
  }

  return initialState;
}

function _createSerializer(config: StoreConfig<any, any>): any {
  return 'serializer' in config
    ? config.serializer || ((action: any) => true)
    : serialize;

  function serialize(action: any) {
    if (isPlainObject(action)) {
      return true;
    }

    console.warn(
      'NgRx: Actions must be plain objects. This will become an error in NgRx 7.',
      'The action that was passed:',
      action
    );

    return true;
  }
}
