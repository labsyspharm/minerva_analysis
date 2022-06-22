import jax
import jax.numpy as jnp
import jax.scipy as jsp
import tensorflow_probability.substrates.jax as jaxp
from functools import partial
import numpy as np


class JaxGaussianMixture:

    def __init__(self):
        self.pi_best = None
        self.mu_best = None
        self.sigma_best = None

    def fit(self, X, num_components):
        pi_best, mu_best, sigma_best = train_em_jax(X, num_components)
        self.pi_best = pi_best
        self.mu_best = mu_best
        self.sigma_best = sigma_best

    def predict(self, X):
        return np.argmax(e_step(X, self.pi_best, self.mu_best, self.sigma_best), axis=-1)


@jax.jit
def e_step(X, pi, mu, sigma):
    mixture_log_prob = jaxp.distributions.MultivariateNormalTriL(
        loc=mu,
        scale_tril=jnp.linalg.cholesky(sigma)
    ).log_prob(X[:, None, ...]) + jnp.log(pi)
    log_membership_weight = mixture_log_prob - jsp.special.logsumexp(
        mixture_log_prob, axis=-1, keepdims=True)
    return jnp.exp(log_membership_weight)


@jax.jit
def m_step(X, membership_weight):
    effect_number = membership_weight.sum(0)
    pi_updated = effect_number / X.shape[0]
    mu_updated = jnp.sum(
        X[:, None, ...] * membership_weight[..., None],
        axis=0) / effect_number[..., None]
    centered_x = X[:, None, ...] - mu_updated
    sigma_updated = jnp.sum(
        jnp.einsum('...i,...j->...ij', centered_x, centered_x) *
        membership_weight[..., None, None],
        axis=0) / effect_number[..., None, None]
    return pi_updated, mu_updated, sigma_updated


@jax.jit
def compute_vlb(X, pi, mu, sigma, membership_weight):
    component_log_prob = jaxp.distributions.MultivariateNormalTriL(
        loc=mu,
        scale_tril=jnp.linalg.cholesky(sigma)
    ).log_prob(X[:, None, ...])
    vlb = membership_weight * (
            jnp.log(pi) + component_log_prob - jnp.log(
        jnp.clip(membership_weight,
                 a_min=jnp.finfo(np.float32).eps)))
    return jnp.sum(vlb)


@partial(jax.jit, static_argnums=(1,))
def train_em_jax(observed, num_comp, n_init=1, rtol=1e-3, max_iter=100, seed=1234):
    def cond_fn(state):
        i, thetas, loss, loss_diff = state
        return jnp.all((i < max_iter) & (loss_diff > rtol))

    @jax.vmap
    def one_step(state):
        i, (pi, mu, sigma), loss, loss_diff = state
        membership_weight = e_step(observed, pi, mu, sigma)
        pi_updated, mu_updated, sigma_updated = m_step(observed, membership_weight)
        loss_updated = compute_vlb(
            observed, pi_updated, mu_updated, sigma_updated, membership_weight)
        loss_diff = jnp.abs((loss_updated / loss) - 1.)
        return (i + 1,
                (pi_updated, mu_updated, sigma_updated),
                loss_updated,
                loss_diff)

    # run EM...
    dims = observed.shape[-1]
    key = jax.random.PRNGKey(seed)
    raw_pi_init = jax.random.uniform(key, shape=(n_init, num_comp))
    pi_init = raw_pi_init / raw_pi_init.sum(-1, keepdims=True)
    key, subkey = jax.random.split(key)
    mu_init = jax.random.normal(subkey, shape=(n_init, num_comp, dims))
    sigma_init = jnp.tile(jnp.eye(dims)[None, ...], (n_init, num_comp, 1, 1))

    init_val = (jnp.zeros([n_init], jnp.int32),
                (pi_init, mu_init, sigma_init),
                -jnp.ones([n_init]) * jnp.inf,
                jnp.ones([n_init]) * jnp.inf)
    num_iter, (pi_est, mu_est, sigma_est), loss, loss_diff = jax.lax.while_loop(
        cond_fn, one_step, init_val)
    index = jnp.argmax(loss)
    pi_best, mu_best, sigma_best = jax.tree_map(
        lambda x: x[index], (pi_est, mu_est, sigma_est))
    return pi_best, mu_best, sigma_best
